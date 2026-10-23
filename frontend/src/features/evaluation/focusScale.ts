/** Lleva el foco a la escala para que el evaluador elija otro valor ("Cambiar" en una sugerencia de IA). */
export const focusScale = (containerId: string) => {
    window.setTimeout(() => {
        document.querySelector<HTMLElement>(`#${containerId} [role="radio"][tabindex="0"]`)?.focus();
    }, 0);
};
