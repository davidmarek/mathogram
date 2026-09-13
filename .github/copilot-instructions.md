# Copilot instructions

## Pull requests on completion

- Every agent that completes repository changes must create a pull request for
  its work unless the user explicitly instructs otherwise.
- If the work already has a pull request, update that pull request rather than
  creating a duplicate. Delegated agents contributing to the same change should
  return their work to the coordinating agent, which is responsible for the PR.
- Include a summary of the changes, verification performed, and any known
  limitations in the PR description, and provide the PR link in the final response.
- If permissions or tooling prevent PR creation, report the blocker explicitly;
  do not claim that a PR was created.

## Screenshot safety in Copilot cloud sessions

In GitHub-hosted Copilot cloud sessions, do not send screenshot or other image
content to the model. This is a workaround for a cloud-agent failure observed in
[run 34719834170](https://github.com/davidmarek/mathogram/actions/runs/34719834170):
PNG `view` calls succeeded, but the next model request terminated the session with
`CAPIError: 400 Error while downloading file. Upstream status code: 404.`

- Do not open image files with `view`, `view_image`, or equivalent image-reading
  tools, including through delegated agents.
- Do not call screenshot tools that return inline images. If screenshots are
  needed, use Playwright directly to save them to disk and return only text
  results or file paths.
- Do not embed images, image URLs, or base64 image data in tool output for model
  inspection. Changing the image path or format is not a verified workaround.
- Do not probe image viewing to see whether it works. The failure can occur after
  the tool succeeds, outside the screenshot script's error handling.

This restriction is specific to cloud sessions. It does not prohibit local
interactive visual inspection or saving screenshots as test artifacts.

## Browser verification without image inspection

- Keep Playwright tests and their existing screenshot/trace capture enabled.
  Prefer DOM or accessibility snapshots, locator assertions, computed styles,
  element bounds, and console/network diagnostics that return text.
- If Playwright MCP navigation fails, use the repository's Playwright tests or
  a direct Playwright script with text-only output instead of abandoning browser
  verification. Report unresolved navigation or test failures.
- Build before running end-to-end tests: `npm run build`, then
  `npm run test:e2e`. The Playwright configuration starts the required preview and
  fixture servers; the preview base URL is
  `http://127.0.0.1:4173/mathogram/`.
- Never describe saved screenshots as visually reviewed unless they actually
  were. When visual inspection would normally be required, explicitly state that
  it was skipped because of the cloud image-handling workaround and describe the
  text-based verification performed instead.
