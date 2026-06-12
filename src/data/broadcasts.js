const BROADCAST_LOGOS = import.meta.glob("../assets/broadcasts/*.{svg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const BROADCASTS_AR = [];

const EXTRA_CHANNELS_BY_ID = {
  tyc: {
    id: "tyc",
    name: "TyC Sports",
    logo: getLocalLogo("tyc-sports.svg"),
  },
  tycPlay: {
    id: "tyc-play",
    name: "TyC Sports Play",
    logo: getLocalLogo("tyc-sports-play.svg"),
  },
  telefe: {
    id: "telefe",
    name: "Telefe",
    logo: getLocalLogo("telefe.svg"),
  },
  disneyEspn: {
    id: "disney-espn",
    name: "Disney+ / ESPN",
    logo: getLocalLogo("disney-espn.svg"),
  },
};

export function getBroadcastInfo(match) {
  const record = BROADCASTS_AR.find(
    (item) => item.matchId === match?.id || item.matchKey === match?.matchKey,
  );

  if (!record) {
    return {
      matchId: match?.id || "",
      status: "pending",
      channels: [],
      sourceName: "",
      sourceUrl: "",
      updatedAt: "",
    };
  }

  const extraChannels = (record.extraChannelIds || [])
    .map((channelId) => EXTRA_CHANNELS_BY_ID[channelId])
    .filter(Boolean);
  const explicitChannels = Array.isArray(record.channels) ? record.channels : [];
  const channels = dedupeChannels([...extraChannels, ...explicitChannels]);

  if (!channels.length || record.status === "pending") {
    return {
      matchId: record.matchId,
      status: "pending",
      channels: [],
      sourceName: record.sourceName || "",
      sourceUrl: record.sourceUrl || "",
      updatedAt: record.updatedAt || "",
    };
  }

  return {
    matchId: record.matchId,
    status: record.status || "confirmed",
    channels,
    sourceName: record.sourceName || "",
    sourceUrl: record.sourceUrl || "",
    updatedAt: record.updatedAt || "",
  };
}

function dedupeChannels(channels) {
  const seen = new Set();
  return channels.filter((channel) => {
    const key = channel.id || channel.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLocalLogo(filename) {
  const entry = Object.entries(BROADCAST_LOGOS).find(([path]) => path.endsWith(`/${filename}`));
  return entry?.[1] || "";
}
