const DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "10minutemail.com",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwaway.email",
  "fakeinbox.com",
  "trashmail.com",
  "getnada.com",
  "mintemail.com",
  "mytemp.email",
  "dispostable.com",
]);

export function isDisposableDomain(domain: string): boolean {
  return DOMAINS.has(domain.toLowerCase());
}
