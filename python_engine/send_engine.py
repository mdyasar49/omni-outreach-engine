import os
import sys
import re
import time
import json
import smtplib
import imaplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid, parseaddr
from mx_verifier import check_domain_mx

def render_template(template_str, context):
    if not template_str:
        return ""
    rendered = template_str
    for k, v in context.items():
        placeholder = f"{{{{{k}}}}}"
        rendered = rendered.replace(placeholder, str(v) if v is not None else "")
    # Clean any leftover unreplaced tags
    rendered = re.sub(r'\{\{[a-zA-Z0-9_]+\}\}', '', rendered)
    return rendered

def get_smtp_connection(account):
    host = account.get("smtp_host", "smtp.gmail.com")
    port = int(account.get("smtp_port", 587))
    user = account.get("smtp_user") or account.get("email")
    pwd = account.get("smtp_pass") or account.get("password")
    use_ssl = account.get("secure", False) or port == 465

    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
        server.ehlo()
        server.starttls()
        server.ehlo()
    
    server.login(user, pwd)
    return server

def save_to_imap_sent(account, raw_email_bytes, label_name=None):
    try:
        imap_host = account.get("imap_host", "imap.gmail.com")
        user = account.get("smtp_user") or account.get("email")
        pwd = account.get("smtp_pass") or account.get("password")
        mail = imaplib.IMAP4_SSL(imap_host, timeout=15)
        mail.login(user, pwd)
        
        # Append to Sent or target label
        box = f'"{label_name}"' if label_name else '"[Gmail]/Sent Mail"'
        try:
            mail.append(box, '\\Seen', imaplib.Time2Internaldate(time.time()), raw_email_bytes)
        except Exception:
            # Fallback to standard Sent
            try:
                mail.append('"[Gmail]/Sent Mail"', '\\Seen', imaplib.Time2Internaldate(time.time()), raw_email_bytes)
            except Exception:
                pass
        mail.logout()
    except Exception as e:
        # Saving to IMAP is non-blocking for dispatch
        pass

def dispatch_batch(config):
    account = config.get("account", {})
    campaign = config.get("campaign", {})
    recipients = config.get("recipients", [])
    options = config.get("options", {})
    
    delay_sec = float(options.get("delay_seconds", 6.0))
    verify_mx_flag = options.get("verify_mx", True)
    label_name = options.get("label_name", "JV-Digital-Marketing")
    
    sender_email = account.get("email")
    sender_name = account.get("name", "Infonix Outreach")
    
    from_header = f'"{sender_name}" <{sender_email}>' if sender_name else sender_email
    
    server = None
    results = []
    
    # Connect SMTP initial
    try:
        server = get_smtp_connection(account)
    except Exception as e:
        err = f"Failed to connect to SMTP server: {str(e)}"
        print(json.dumps({"type": "fatal_error", "message": err}), flush=True)
        return {"success": False, "error": err, "results": []}

    print(json.dumps({
        "type": "started",
        "total": len(recipients),
        "sender": sender_email,
        "campaign": campaign.get("name", "Default Campaign")
    }), flush=True)

    for idx, rec in enumerate(recipients, 1):
        to_email = rec.get("email", "").strip()
        if not to_email or "@" not in to_email:
            res_item = {"index": idx, "email": to_email, "status": "skipped", "reason": "Invalid email format"}
            results.append(res_item)
            print(json.dumps({"type": "progress", "item": res_item}), flush=True)
            continue

        domain = to_email.split("@")[-1].strip().lower()

        # Pre-flight MX verify
        if verify_mx_flag:
            has_mx = check_domain_mx(domain)
            if not has_mx:
                res_item = {"index": idx, "email": to_email, "status": "skipped", "reason": f"Dead domain / No MX records for {domain}"}
                results.append(res_item)
                print(json.dumps({"type": "progress", "item": res_item}), flush=True)
                continue

        # Build context
        context = {
            "name": rec.get("name") or rec.get("contact_person") or "Prospective Partner",
            "company": rec.get("company") or rec.get("agency_name") or "Your Agency",
            "city": rec.get("city") or "your region",
            "email": to_email,
            **rec
        }

        subj_rendered = render_template(campaign.get("subject", "Partnership Opportunity"), context)
        html_rendered = render_template(campaign.get("html_template", ""), context)
        text_rendered = render_template(campaign.get("text_template", ""), context)

        # Build MIME Message
        msg = MIMEMultipart("alternative")
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Subject"] = subj_rendered
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="infogenx.com")
        msg["Reply-To"] = sender_email
        msg["X-Mailer"] = "Infonix-Omni-Engine/2.0"

        if text_rendered:
            msg.attach(MIMEText(text_rendered, "plain", "utf-8"))
        if html_rendered:
            msg.attach(MIMEText(html_rendered, "html", "utf-8"))

        raw_bytes = msg.as_bytes()

        # Send with auto-reconnect retry
        sent = False
        error_msg = None
        for attempt in range(2):
            try:
                server.sendmail(sender_email, [to_email], raw_bytes)
                sent = True
                break
            except (smtplib.SMTPServerDisconnected, smtplib.SMTPException, Exception) as e:
                error_msg = str(e)
                try:
                    server = get_smtp_connection(account)
                except Exception as ex2:
                    error_msg = f"Reconnect failed: {str(ex2)}"

        if sent:
            # Optionally save copy to Sent
            if options.get("save_to_sent", True):
                save_to_imap_sent(account, raw_bytes, label_name)

            res_item = {
                "index": idx,
                "email": to_email,
                "recipient_name": context["name"],
                "company": context["company"],
                "status": "sent",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            results.append(res_item)
            print(json.dumps({"type": "progress", "item": res_item}), flush=True)
        else:
            res_item = {
                "index": idx,
                "email": to_email,
                "recipient_name": context["name"],
                "status": "failed",
                "error": error_msg
            }
            results.append(res_item)
            print(json.dumps({"type": "progress", "item": res_item}), flush=True)

        # Sleep throttling delay
        if idx < len(recipients):
            time.sleep(delay_sec)

    try:
        server.quit()
    except Exception:
        pass

    summary = {
        "type": "finished",
        "total": len(recipients),
        "sent": sum(1 for r in results if r.get("status") == "sent"),
        "failed": sum(1 for r in results if r.get("status") == "failed"),
        "skipped": sum(1 for r in results if r.get("status") == "skipped"),
        "results": results
    }
    print(json.dumps(summary), flush=True)
    return summary

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if os.path.exists(sys.argv[1]):
            with open(sys.argv[1], "r", encoding="utf-8") as f:
                cfg = json.load(f)
        else:
            cfg = json.loads(sys.argv[1])
    else:
        cfg = json.loads(sys.stdin.read())

    dispatch_batch(cfg)
