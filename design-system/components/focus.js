// Focus: the ring is for the keyboard. A field you click or tap into shows its caret, not the ring
// (Marcus 13 Oct: "fokus kommer fra tab eller sånt"). Browsers always match :focus-visible on a text
// field (Chromium on a native select too), however it got focus, so this marks a field focused by a
// pointer with data-ui-focus="pointer" until it loses focus, and the field components turn their ring
// off for it (field, input-group, combobox, composer, input-otp, native select). Tab or Shift+Tab to a
// field and the ring is there.
// Round 13 (Marcus 21 Oct, #10, #12, #40: "Ting har litt for lett for å få focus ring"; PROPOSED): the
// ring shows ONLY while she moves with Tab. Chromium also lights :focus-visible on a button that gets the
// focus back after Esc closes its popover or menu (Esc is a key), and on a section a link moved the focus
// to. So the page keeps one mode: Tab or Shift+Tab turns the ring on; a pointer (mouse, pen, finger)
// turns it off; Esc, Enter, Space, typing and arrow keys never turn it on (arrows keep it on while it is
// on, so a menu or a tab list walked with the keys keeps its ring); focus moved by code after a pointer
// action stays without it. While the ring is off, whatever takes the focus is marked
// data-ui-focus="pointer" and r13-chat.css takes its ring away; the html element carries
// data-ui-ring="keyboard" while it is on.
(() => {
  const root = document.documentElement;
  let ring = false;
  const mark = (el) => {
    if (!(el instanceof Element)) return;
    if (ring) el.removeAttribute("data-ui-focus");
    else el.setAttribute("data-ui-focus", "pointer");
  };
  const set = (on) => {
    ring = on;
    if (on) root.setAttribute("data-ui-ring", "keyboard");
    else root.removeAttribute("data-ui-ring");
  };
  // A pointer turns the ring off, also on what already has the focus (a field she Tabbed to, then clicked).
  document.addEventListener("pointerdown", () => {
    set(false);
    mark(document.activeElement);
  }, true);
  // Only Tab turns it on. Before the focus moves, so the next element is unmarked as it arrives; and on what has
  // the focus now, in case Tab has nowhere else to go.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    set(true);
    mark(document.activeElement);
  }, true);
  document.addEventListener("focusin", (e) => mark(e.target), true);
  document.addEventListener("focusout", (e) => { if (e.target instanceof Element) e.target.removeAttribute("data-ui-focus"); }, true);
})();
