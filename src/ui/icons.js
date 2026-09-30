/* Иконки (inline SVG, currentColor). */
const s = (d, w = 2) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
export const I = {
  home: s('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  progress: s('<path d="M4 18l5-6 4 4 7-9"/><path d="M15 7h5v5"/>'),
  history: s('<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  catalog: s('<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>'),
  profile: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>', 2.6),
  minus: s('<path d="M5 12h14"/>', 2.6),
  back: s('<path d="M15 5l-7 7 7 7"/>', 2.4),
  more: s('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>', 2.4),
  check: s('<path d="M5 12.5l4.5 4.5L19 7"/>', 3),
  x: s('<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
  search: s('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', 2.2),
  chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  edit: s('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  repeat: s('<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>'),
  up: s('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: s('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  trash: s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  calendar: s('<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  flag: s('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  report: s('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  plate: s('<rect x="3" y="10" width="18" height="4" rx="1"/><rect x="6" y="6" width="3" height="12" rx="1"/><rect x="15" y="6" width="3" height="12" rx="1"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M4 7h3M17 7h3M4 17h9M17 17h3M9 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/>'),
  timer: s('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 2M9 3h6"/>'),
  /* четырёхлучевая звезда — декоративный акцент стиля */
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z"/></svg>'
};
export const star = (cls = "") => '<span class="star4 '+cls+'" aria-hidden="true">'+I.star+'</span>';
