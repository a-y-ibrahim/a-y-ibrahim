// Refreshes the PR "Status" badges in README.md by querying the GitHub API.
// Flips OPEN -> MERGED / CLOSED automatically. Only touches the badge inside
// each <!--status:owner/repo#num--> ... <!--/status--> marker, so nothing else
// in the README is ever changed. Run by .github/workflows/refresh-contributions.yml.

const fs = require('fs');
const path = require('path');

const README = path.join(__dirname, '..', 'README.md');

// Pull requests to track. Add a line here to track a new contribution.
const PRS = [
  'bluesky-social/social-app#11066',
  'bluesky-social/atproto#5222',
  'obsidianmd/obsidian-clipper#909',
  'punkpeye/awesome-mcp-servers#9214',
  'punkpeye/awesome-mcp-servers#9267',
];

function badge(status) {
  const seg = {
    merged: 'MERGED-5DCAA5',
    open: 'OPEN-8B7CF0',
    closed: 'CLOSED-8b949e',
  }[status] || 'OPEN-8B7CF0';
  return `<img src="https://img.shields.io/badge/${seg}?style=flat-square&labelColor=1a1a2e" alt="${status}" />`;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchStatus(repo, num, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${num}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'a-y-ibrahim-profile-status',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}#${num}`);
  const pr = await res.json();
  if (pr.merged) return 'merged';
  return pr.state === 'closed' ? 'closed' : 'open';
}

(async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.error('GITHUB_TOKEN missing'); process.exit(1); }

  let md = fs.readFileSync(README, 'utf8');
  let changed = false;

  for (const key of PRS) {
    const [repo, num] = key.split('#');
    let status;
    try {
      status = await fetchStatus(repo, num, token);
    } catch (e) {
      console.log('skip ' + key + ': ' + e.message);
      continue;
    }
    const re = new RegExp(`(<!--status:${escapeRe(key)}-->)[\\s\\S]*?(<!--/status-->)`);
    if (!re.test(md)) { console.log('no marker for ' + key); continue; }
    const before = md;
    md = md.replace(re, (_m, open, close) => open + badge(status) + close);
    if (md !== before) { changed = true; console.log('set ' + key + ' -> ' + status); }
    else { console.log('unchanged ' + key + ' (' + status + ')'); }
  }

  if (changed) {
    fs.writeFileSync(README, md);
    console.log('README.md updated');
  } else {
    console.log('no changes');
  }
})();
