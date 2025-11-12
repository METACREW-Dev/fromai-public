// scripts/append-meta.js
import { readFileSync, writeFileSync } from "fs";

// ---- Parse CLI args ----
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, val] = arg.replace(/^--/, "").split("=");
    return [key, val ?? true];
  })
);

const targetPath = args.target || "./index.html";
const apiUrl = args.api || args["api-url"] || null;
const base44Url = args.url || args.base44_url || null;
const projectKey = args.project || args.project_key || null;
const faviconUrl = args.favicon || null;
const cdnUrl = args.cdn || null;
const overrideTitle = args.title || null;

// ---- Helpers ----
async function fetchMeta(apiUrl, base44Url, projectKey) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base44_url: base44Url,
      project_key: projectKey,
    }),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

// ✅ Remove duplicate SVG favicons, keep other formats
function cleanSvgFavicons(html) {
  const faviconLinks = [...html.matchAll(/<link[^>]+rel=["']icon["'][^>]*>/gi)];
  if (faviconLinks.length <= 1) return html; // nothing to clean

  let svgFavicons = faviconLinks.filter((match) =>
    match[0].includes('type="image/svg+xml"')
  );

  if (svgFavicons.length <= 1) return html; // only 0 or 1 SVG favicon, skip

  // keep last SVG favicon, remove others
  const lastSvg = svgFavicons.pop()[0];
  let cleaned = html;
  svgFavicons.forEach((f) => {
    cleaned = cleaned.replace(f[0], "");
  });

  // Remove extra blank lines left by deletion
  cleaned = cleaned.replace(/^\s*[\r\n]/gm, "");
  return cleaned;
}

// ✅ Replace or append 1 new favicon (any type)
function replaceOrAppendFavicon(html, faviconUrl) {
  if (!faviconUrl) return html;

  // remove duplicate SVG favicons first
  let cleaned = cleanSvgFavicons(html);

  // Replace existing SVG favicon if any
  if (cleaned.match(/<link[^>]+rel=["']icon["'][^>]*type=["']image\/svg\+xml["'][^>]*>/i)) {
    cleaned = cleaned.replace(
      /<link[^>]+rel=["']icon["'][^>]*type=["']image\/svg\+xml["'][^>]*>/gi,
      `<link rel="icon" href="${faviconUrl}" type="image/svg+xml">`
    );
  } else {
    // if no svg favicon, append one before </head>
    cleaned = cleaned.replace(
      /<\/head>/i,
      `  <link rel="icon" href="${faviconUrl}" type="image/svg+xml">\n</head>`
    );
  }

  return cleaned;
}

// ✅ Replace or append title
function replaceOrAppendTitle(html, newTitle) {
  if (!newTitle) return html;
  if (html.match(/<title[^>]*>[\s\S]*?<\/title>/i)) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${newTitle}</title>`);
  }
  return html.replace(/<\/head>/i, `  <title>${newTitle}</title>\n</head>`);
}

function extractTitleFromMeta(metaHtml) {
  const m = metaHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function removeTitleFromMeta(metaHtml) {
  return metaHtml.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "").trim();
}

function applyOptionalTransforms(metaHtml, { cdnUrl, base44Url }) {
  let result = metaHtml.trim();
  if (cdnUrl && base44Url) {
    const base = new URL(base44Url).origin;
    const regex = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    result = result.replace(regex, cdnUrl);
  }
  return result;
}

function appendToHead(targetHtml, extraHeadHtml) {
  const headMatch = targetHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const currentHeadContent = headMatch[1];
    const newHeadContent = `${currentHeadContent.trim()}\n${extraHeadHtml}\n`;
    return targetHtml.replace(
      /<head[^>]*>[\s\S]*?<\/head>/i,
      `<head>\n${newHeadContent}</head>`
    );
  } else {
    return targetHtml.replace(
      /<html[^>]*>/i,
      `$&\n<head>\n${extraHeadHtml}\n</head>`
    );
  }
}

// ---- Main ----
(async () => {
  try {
    let targetHtml = "";
    try {
      targetHtml = readFileSync(targetPath, "utf8");
    } catch {
      console.warn("⚠️ Target file not found, creating new file...");
      targetHtml = "<!doctype html><html><head></head><body></body></html>";
    }

    if (!apiUrl || !base44Url || !projectKey) {
      console.error("❌ Required: --api=, --url=, and --project=");
      process.exit(1);
    }

    console.log(`📡 Fetching meta from ${apiUrl}...`);
    const metaHtml = await fetchMeta(apiUrl, base44Url, projectKey);
    if (!metaHtml.trim()) {
      console.error("❌ API returned empty meta block.");
      process.exit(1);
    }

    const titleFromMeta = extractTitleFromMeta(metaHtml);
    const metaWithoutTitle = removeTitleFromMeta(metaHtml);
    const transformed = applyOptionalTransforms(metaWithoutTitle, {
      cdnUrl,
      base44Url,
    });

    let newHtml = appendToHead(targetHtml, transformed);

    newHtml = cleanSvgFavicons(newHtml);
    if (faviconUrl) newHtml = replaceOrAppendFavicon(newHtml, faviconUrl);

    const finalTitle = overrideTitle || titleFromMeta;
    if (finalTitle) newHtml = replaceOrAppendTitle(newHtml, finalTitle);

    writeFileSync(targetPath, newHtml, "utf8");
    console.log(`✅ Meta appended + favicon/title cleaned successfully → ${targetPath}`);
  } catch (err) {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  }
})();
