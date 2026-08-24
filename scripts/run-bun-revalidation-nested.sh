#!/usr/bin/env bash
set -euo pipefail

blog_dir=/Users/antoniofulg/Projects/blog
creatista_lock=/var/folders/lc/_v1mn5h560d2tsmz474y7d1c0000gn/T/creatista-test.lock

cd "$blog_dir"
lockf -ks "$creatista_lock" bash -c "cd '$blog_dir' && bun run scripts/run-bun-revalidation-final.ts"
