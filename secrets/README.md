# Local secrets

Two 32-byte secrets are mounted into the backend container via podman secrets.

Generate them once before first `podman compose up`:

```bash
openssl rand 32 > secrets/kms_key
openssl rand 32 > secrets/email_hash_salt
chmod 600 secrets/kms_key secrets/email_hash_salt
```

`kms_key` is the local KMS wrapping key. `email_hash_salt` is the HMAC salt used to hash recipient email addresses before storage.

Never commit these files. The `.gitignore` in this directory enforces that.

For production, replace `KMS_BACKEND=local` with a cloud KMS (see `backend/src/kms/aws.ts` stub) and remove `kms_key` from the secrets block in `compose.yaml`.
