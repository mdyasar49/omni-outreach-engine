import os
import sys
import re
import time
import json
import email
from email.header import decode_header
import smtplib
import imaplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid, parseaddr

IGNORE_EMAILS = {
    "mailer-daemon@googlemail.com", "mailer-daemon@gmail.com",
    "postmaster@gmail.com", "nobody@google.com"
}

IGNORE_PREFIXES = (
    "mailer-daemon", "postmaster", "no-reply", "noreply", "bounce", 
    "donotreply", "auto-reply", "notification", "notifications"
)

def decode_mime_words(s):
    if not s: return ""
    try:
        fragments = decode_header(s)
        res = []
        for frag, enc in fragments:
            if isinstance(frag, bytes):
                res.append(frag.decode(enc or 'utf-8', errors='ignore'))
            else:
                res.append(str(frag))
        return "".join(res)
    except Exception:
        return str(s)

def get_body_text(msg):
    text = ""
    try:
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdispo = str(part.get('Content-Disposition'))
                if ctype in ('text/plain', 'message/delivery-status') and 'attachment' not in cdispo:
                    payload = part.get_payload(decode=True)
                    if payload:
                        text += payload.decode('utf-8', errors='ignore') + "\n"
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                text = payload.decode('utf-8', errors='ignore')
    except Exception:
        pass
    return text

def scan_inbox_and_replies(config):
    user = config.get("user")
    password = config.get("password")
    imap_host = config.get("imap_host", "imap.gmail.com")
    label_name = config.get("label_name", "JV-Digital-Marketing")
    
    mail = imaplib.IMAP4_SSL(imap_host)
    mail.login(user, password)
    mail.select("INBOX")
    
    status, messages = mail.search(None, 'ALL')
    if status != 'OK' or not messages or not messages[0]:
        mail.logout()
        return {"bounces": [], "replies": [], "discovered_emails": []}

    msg_ids = messages[0].split()
    recent_ids = msg_ids[-50:]
    
    bounces = []
    replies = []
    discovered = []

    for m_id in reversed(recent_ids):
        res, data = mail.fetch(m_id, "(RFC822)")
        if res != "OK": continue
        raw = None
        for p in data:
            if isinstance(p, tuple) and len(p) > 1:
                raw = p[1]
                break
        if not raw: continue

        msg = email.message_from_bytes(raw)
        subject = decode_mime_words(msg.get("Subject", ""))
        from_hdr = decode_mime_words(msg.get("From", ""))
        sender = parseaddr(from_hdr)[1].lower()

        if sender == user.lower(): continue

        body = get_body_text(msg)

        # Check for bounce
        if "mailer-daemon" in sender or "delivery status" in subject.lower() or "failure" in subject.lower():
            # Extract recipient
            m_rec = re.search(r'Final-Recipient:\s*rfc822;\s*([^\s;]+)', body, re.IGNORECASE)
            bounced_recip = m_rec.group(1).strip().lower() if m_rec else ""
            if not bounced_recip:
                all_ems = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', body)
                for e in all_ems:
                    el = e.lower().strip(".,;:()<>[]\"' ")
                    if el != user.lower() and not el.startswith('mailer-daemon'):
                        bounced_recip = el
                        break
            bounces.append({
                "from": from_hdr,
                "subject": subject,
                "bounced_email": bounced_recip,
                "date": msg.get("Date", "")
            })
            continue

        # Check for JV reply
        is_reply = ("re:" in subject.lower() or "joint venture" in subject.lower() or msg.get("In-Reply-To"))
        if is_reply:
            try:
                mail.copy(m_id, f'"{label_name}"')
            except Exception:
                pass

            # Extract alternative emails in body
            cand_emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', body)
            found_alts = []
            for ce in cand_emails:
                cl = ce.lower().strip(".,;:()<>[]\"' ")
                if cl not in IGNORE_EMAILS and cl != user.lower() and cl != sender:
                    if not any(cl.startswith(p) for p in IGNORE_PREFIXES):
                        found_alts.append(cl)

            replies.append({
                "from": from_hdr,
                "sender_email": sender,
                "subject": subject,
                "date": msg.get("Date", ""),
                "snippet": body[:200].strip(),
                "discovered_alternatives": list(set(found_alts))
            })
            for alt in set(found_alts):
                discovered.append({"email": alt, "discovered_from": sender, "subject": subject})

    mail.logout()
    return {"bounces": bounces, "replies": replies, "discovered_emails": discovered}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cfg = json.loads(sys.argv[1])
    else:
        cfg = json.loads(sys.stdin.read())
    res = scan_inbox_and_replies(cfg)
    print(json.dumps(res, indent=2))
