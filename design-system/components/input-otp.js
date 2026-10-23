// Input OTP: mirrors one real input into the slots of a sign-in code. DECIDED 13 Oct, from round 7.
// The real input (autocomplete="one-time-code", maxlength = the number of slots) lies invisibly over the
// slots, so typing, pasting and the phone's code autofill work as usual. This script writes each
// character into its slot and marks the active slot with data-active="true" (like shadcn's input-otp),
// keeps the caret at the end, and drops anything that is not a digit when inputmode="numeric".
// Delegated from the document and safe to load more than once. Markup:
//   <div class="ui-input-otp"><input class="ui-input-otp-input" inputmode="numeric" maxlength="6"
//     autocomplete="one-time-code" aria-label="Sign-in code">
//     <div class="ui-input-otp-group" aria-hidden="true"><div class="ui-input-otp-slot"></div>…</div>
//     <div class="ui-input-otp-separator" role="separator"></div> …</div>
// Events: "complete" on .ui-input-otp when every slot is filled, detail { value }.
// fumeOtp(root) draws the current values under root (call it after rendering from a template).
(function () {
  if (typeof window === "undefined" || window.fumeOtp) return;
  const isOtp = (el) => el instanceof HTMLInputElement && el.matches(".ui-input-otp-input");
  function render(root) {
    const input = root.querySelector(".ui-input-otp-input");
    if (!input) return;
    const slots = Array.from(root.querySelectorAll(".ui-input-otp-slot"));
    const v = input.value, on = document.activeElement === input && !input.disabled;
    const active = Math.min(v.length, slots.length - 1);
    slots.forEach((s, i) => {
      s.textContent = v[i] || "";
      s.setAttribute("data-active", String(on && i === active));
    });
  }
  const end = (i) => { try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} };
  document.addEventListener("input", (e) => {
    const i = e.target;
    if (!isOtp(i)) return;
    const root = i.closest(".ui-input-otp");
    const max = i.maxLength > 0 ? i.maxLength : root.querySelectorAll(".ui-input-otp-slot").length;
    const clean = (i.inputMode === "numeric" ? i.value.replace(/\D/g, "") : i.value.replace(/[^0-9a-z]/gi, "").toUpperCase()).slice(0, max);
    if (clean !== i.value) i.value = clean;
    end(i);
    render(root);
    if (clean.length === max) root.dispatchEvent(new CustomEvent("complete", { bubbles: true, detail: { value: clean } }));
  });
  ["focusin", "focusout"].forEach((t) => document.addEventListener(t, (e) => {
    if (!isOtp(e.target)) return;
    if (t === "focusin") end(e.target);
    render(e.target.closest(".ui-input-otp"));
  }));
  ["click", "keyup"].forEach((t) => document.addEventListener(t, (e) => { if (isOtp(e.target)) end(e.target); }));
  window.fumeOtp = function fumeOtp(root) {
    (root || document).querySelectorAll(".ui-input-otp").forEach(render);
  };
})();
