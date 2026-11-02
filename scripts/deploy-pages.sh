#!/usr/bin/env bash
# Build first, then deploy: npm run build && ./scripts/deploy-pages.sh HEAD
# Restore a milestone: build that tag in a separate checkout, then pass its ref and dist path.
# Only promptarmor/ in the existing Pages repository is replaced. Existing site files stay intact.
set -euo pipefail

project_dir=$(cd "$(dirname "$0")/.." && pwd)
source_ref=${1:-HEAD}
dist_dir=${2:-"$project_dir/dist"}
source_sha=$(git -C "$project_dir" rev-parse --verify "$source_ref^{commit}")
pages_remote=git@github.com:cfireborn/cfireborn.github.io.git

[[ -f "$dist_dir/index.html" ]] || { echo "Build output is missing: $dist_dir/index.html" >&2; exit 1; }
[[ -z "$(find "$dist_dir" -type l -print -quit)" ]] || { echo "Build output must not contain symlinks." >&2; exit 1; }
[[ -z "$(find "$dist_dir" -name .git -print -quit)" ]] || { echo "Build output must not contain Git metadata." >&2; exit 1; }

deploy_dir=$(mktemp -d "${TMPDIR:-/tmp}/promptarmor-pages.XXXXXX")
trap 'rm -rf "$deploy_dir"' EXIT
mkdir "$deploy_dir/release"
cp -R "$dist_dir/." "$deploy_dir/release/"
printf '{"source":"https://github.com/cfireborn/promptarmor","commit":"%s"}\n' "$source_sha" > "$deploy_dir/release/release.json"

git clone --quiet --filter=blob:none --sparse --depth=1 --single-branch --branch master "$pages_remote" "$deploy_dir/site"
git -C "$deploy_dir/site" sparse-checkout set promptarmor
mkdir -p "$deploy_dir/site/promptarmor"
rsync -a --delete "$deploy_dir/release/" "$deploy_dir/site/promptarmor/"
git -C "$deploy_dir/site" add --all -- promptarmor

while IFS= read -r -d '' changed_path; do
  [[ "$changed_path" == promptarmor/* ]] || { echo "Refusing change outside promptarmor/: $changed_path" >&2; exit 1; }
done < <(git -C "$deploy_dir/site" diff --cached --name-only -z)

if git -C "$deploy_dir/site" diff --cached --quiet; then
  echo "This build is already deployed."
else
  git -C "$deploy_dir/site" commit --quiet -m "Deploy ClearPath Review ${source_sha:0:7}"
  # A normal push rejects concurrent upstream changes; rerun to rebuild from the latest master.
  git -C "$deploy_dir/site" push origin HEAD:master
fi

echo "Pages commit: $(git -C "$deploy_dir/site" rev-parse HEAD)"
echo "Source commit: $source_sha"
echo "URL: https://cfireborn.github.io/promptarmor/"
echo "Wait for Pages deployment, then verify release.json and the app in a browser."
