# Disabled inherited workflows

These YAML files are archived outside `.github/workflows`, so GitHub Actions does not execute them. This preserves the inherited workflows for reference without leaving any push, PR, tag, schedule or manual trigger enabled.

- `branch_preview.yml`: upstream branch preview
- `pr_preview.yml`: upstream external PR preview
- `tag_release.yml`: upstream Netlify release
- `tauri_release.yml`: tagged Windows/Tauri release
- `deploy_release.yml`: original release-branch Pages workflow from baseline `d53123399a7ab6278d3d1b704e111bef728b727e`

The replacement deployment is `.github/workflows/pages.yml`. Do not move the archived files back into the active directory unless intentionally re-enabling them.
