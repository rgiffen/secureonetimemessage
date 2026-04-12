export function loggerOptions(level: string) {
  return {
    level,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.referer",
        'req.headers["x-forwarded-for"]',
        "req.body",
        "res.body",
        "email",
        "ciphertext",
        "kServer",
        "otp",
      ],
      remove: true,
    },
    serializers: {
      req(req: { method: string; url: string; ip?: string }) {
        return {
          method: req.method,
          url: req.url.split("#")[0]!.split("?")[0]!,
          remoteAddress: req.ip,
        };
      },
    },
  };
}
