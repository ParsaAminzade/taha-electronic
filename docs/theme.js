/* Light / dark theme. Loaded in <head> (before the page paints) so the page never flashes the wrong colours.
   Choice: "system" (follow the device, default), "light" or "dark"; remembered per visitor.
   CSS only reads <html data-scheme="light|dark">. A button with id="themeBtn" cycles system -> dark -> light. */
(function () {
  "use strict";
  var d = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null, choice = "system";
  try { var s = localStorage.getItem("tt-theme"); if (s === "light" || s === "dark") choice = s; } catch (e) {}
  var LABEL = {system: "تم: خودکار، طبق تنظیم دستگاه", dark: "تم: تیره", light: "تم: روشن"};
  function apply() {
    var dark = choice === "dark" || (choice === "system" && mq && mq.matches);
    d.setAttribute("data-scheme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", dark ? "#0A1A12" : "#0A2A1C");
    var b = document.getElementById("themeBtn");
    if (b) { b.setAttribute("data-t", choice); b.setAttribute("aria-label", LABEL[choice] + ". برای تغییر بزنید"); b.title = LABEL[choice]; }
    try { window.dispatchEvent(new CustomEvent("themechange", {detail: {dark: dark}})); } catch (e) {}
  }
  function set(c) { choice = c; try { if (c === "system") localStorage.removeItem("tt-theme"); else localStorage.setItem("tt-theme", c); } catch (e) {} apply(); }
  if (mq) { var on = function () { if (choice === "system") apply(); }; mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on); }
  apply();
  document.addEventListener("DOMContentLoaded", apply);                  // paint the button once it exists
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#themeBtn"); if (!b) return;
    set({system: "dark", dark: "light", light: "system"}[choice]);
  });
  window.TTTheme = {set: set, get: function () { return choice; }};
})();
