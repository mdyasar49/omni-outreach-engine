import sys
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor

def check_domain_mx(domain):
    domain = domain.strip().lower()
    if not domain or '.' not in domain:
        return False
    try:
        res = subprocess.run(["nslookup", "-type=mx", domain], capture_output=True, text=True, timeout=3)
        out = res.stdout.lower()
        if "mail exchanger" in out or "mx preference" in out:
            return True
        return False
    except Exception:
        return False

def verify_email_list(emails):
    results = {}
    unique_domains = list(set(e.split('@')[-1].strip().lower() for e in emails if '@' in e))
    
    domain_status = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(check_domain_mx, d): d for d in unique_domains}
        for f in futures:
            d = futures[f]
            domain_status[d] = f.result()

    for e in emails:
        if '@' not in e:
            results[e] = {"valid": False, "reason": "Malformed email format"}
        else:
            d = e.split('@')[-1].strip().lower()
            valid = domain_status.get(d, False)
            results[e] = {
                "valid": valid,
                "domain": d,
                "reason": "Active MX records verified" if valid else "No MX records found / Dead domain"
            }
    return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        input_data = sys.argv[1]
        try:
            emails = json.loads(input_data)
        except Exception:
            emails = [input_data]
    else:
        emails = [line.strip() for line in sys.stdin if line.strip()]

    output = verify_email_list(emails)
    print(json.dumps(output, indent=2))
