// Touch: iOS Safari only shows :active (the pressed state) on tap when the page listens for touches.
// This passive, empty listener is that switch. Load it once per page, with base.css.
document.addEventListener("touchstart", () => {}, { passive: true });
