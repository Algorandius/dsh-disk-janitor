# Publishing `dsh-disk-janitor`

Everything except the account and the network is ready: the manifest is public
(`name`, `license: MIT`, `publishConfig.access: public`), the bundle patch and
the client module id both say `dsh-disk-janitor`, and `pnpm pack` produces a
clean 12-file tarball.

## 1. One-time prerequisites

1. An npm account with access to the unscoped name `dsh-disk-janitor`
   (checked 2026-10-26: the name was still free).
2. A **Granular Access Token** with `Read and write` on `dsh-disk-janitor`
   (npm → avatar → Access Tokens → Generate New Token).
3. Put the token in `%USERPROFILE%\.npmrc` (one line, never commit it):

   ```
   //registry.npmjs.org/:_authToken=<token>
   ```

4. A network that can reach `registry.npmjs.org` from the shell:

   ```bash
   curl -I https://registry.npmjs.org/    # expect HTTP/2 200
   ```

## 2. Publish

```bash
cd "E:\deepseek harness workspace\临时工作区\dsh-disk-janitor"
node "D:\DSHHome\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" \
  "D:\DSHHome\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" \
  publish --access public --no-git-checks
```

The first publish claims `dsh-disk-janitor@0.1.0`. Bump `version` for every
later release — npm refuses to overwrite a published version.

## 3. Verify the release

```bash
curl -s https://registry.npmjs.org/dsh-disk-janitor | head -c 400
npm view dsh-disk-janitor@0.1.0 dist.tarball dist.integrity
```

Install it in a scratch profile to prove the published artifact loads:

```bash
dsh plugin --profile scratch add dsh-disk-janitor@0.1.0
```

## 4. If npm stays unreachable

Ship the packed artifact instead — it is the same bytes npm would receive:

```bash
dsh plugin --profile desktop add "E:\deepseek harness workspace\临时工作区\dsh-disk-janitor-0.1.0.tgz"
```

`dsh-disk-janitor-0.1.0.tgz` (sha256
`9dec4c5701149ea8f8b85c37c2419206314387ef2807362b1eb9022434ed3aa8`) can be
attached to a GitHub release, sent directly, or installed from a local path.
