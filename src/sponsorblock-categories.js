/**
 * The SponsorBlock categories: their option in the settings panel (shown
 * under "Enable SponsorBlock"), and their API id, color on the progress bar
 * and name in the "Skipping ..." toast.
 *
 * Colors and names from https://github.com/ajayyy/SponsorBlock/blob/9392d16617d2d48abb6125c00e2ff6042cb7bebe/src/config.ts#L179-L233
 */
export const SPONSORBLOCK_CATEGORIES = [
  {
    id: 'sponsor',
    color: '#00d400',
    name: 'sponsored segment',
    option: {
      key: 'enableSponsorBlockSponsor',
      default: true,
      desc: 'Sponsors',
      hint: 'Paid promotions and advertisements inside the video.'
    }
  },
  {
    id: 'intro',
    color: '#00ffff',
    name: 'intro',
    option: {
      key: 'enableSponsorBlockIntro',
      default: true,
      desc: 'Intros',
      hint: 'Intro animations and intermissions with no actual content.'
    }
  },
  {
    id: 'outro',
    color: '#0202ed',
    name: 'outro',
    option: {
      key: 'enableSponsorBlockOutro',
      default: true,
      desc: 'Outros',
      hint: 'End cards and credits.'
    }
  },
  {
    id: 'interaction',
    color: '#cc00ff',
    name: 'interaction reminder',
    option: {
      key: 'enableSponsorBlockInteraction',
      default: true,
      desc: 'Interaction reminders',
      hint: 'Reminders to like, subscribe or follow.'
    }
  },
  {
    id: 'selfpromo',
    color: '#ffff00',
    name: 'self-promotion',
    option: {
      key: 'enableSponsorBlockSelfPromo',
      default: true,
      desc: 'Self promotion',
      hint: "Unpaid plugs for merch, donations or the creator's other channels."
    }
  },
  {
    id: 'music_offtopic',
    color: '#ff9900',
    name: 'non-music part',
    option: {
      key: 'enableSponsorBlockMusicOfftopic',
      default: true,
      desc: 'Non-music in music videos',
      hint: 'Talking and other non-music parts of music videos.'
    }
  },
  {
    id: 'preview',
    color: '#008fd6',
    name: 'recap or preview',
    option: {
      key: 'enableSponsorBlockPreview',
      default: false,
      desc: 'Recaps and previews',
      hint: 'Recaps of earlier episodes and previews of what is coming.'
    }
  }
];
