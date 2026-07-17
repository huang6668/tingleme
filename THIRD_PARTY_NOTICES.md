# Third-party notices

The source repository intentionally contains no third-party executable files.
GitHub Actions downloads the platform-specific tools below while building an
installer, places them in a temporary ignored directory, and bundles them as
separate resources.

## yt-dlp

- Project: https://github.com/yt-dlp/yt-dlp
- Purpose: supported-site metadata extraction and media download
- License: Unlicense, with bundled components under their respective licenses
- Verification: the build checks the downloaded release asset against the
  release's official `SHA2-256SUMS` file

The generated installer includes `YT_DLP_THIRD_PARTY_LICENSES.txt` beside the
tool.

## FFmpeg

- Binary source: https://github.com/eugeneware/ffmpeg-static
- Upstream project: https://ffmpeg.org/
- Purpose: audio encoding, metadata writing and cover embedding
- Binary release pinned by the build script: `b6.0` (FFmpeg 6.0)

The exact license and build information supplied with the selected binary are
downloaded into the installer as `FFMPEG_LICENSE.txt` and
`FFMPEG_README.txt`. Anyone distributing a generated installer is responsible
for complying with those terms and any source-offer obligations that apply to
the selected build.

