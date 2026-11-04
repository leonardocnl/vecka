// Antes da pintura: tema e tamanho da letra salvos neste aparelho (ver
// src/app/_components/appearance.ts). Sem tema salvo, o CSS segue o sistema.
(function () {
    try {
        var root = document.documentElement;
        var theme = localStorage.getItem("vecka-theme");
        if (theme === "dark" || theme === "light") root.classList.add(theme);
        var step = localStorage.getItem("vecka-font-step");
        if (step === "0" || step === "1" || step === "2" || step === "3") root.dataset.font = step;
    } catch {
        // sem localStorage: padrões
    }
})();
