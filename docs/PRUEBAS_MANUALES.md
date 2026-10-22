# Pruebas manuales — evaluación pública (Paso 6)

Complementan las pruebas automáticas (`python backend/manage.py test` y `npm test`). Se hacen
contra el backend real, con el catálogo cargado (`seed_guios_catalog`), en
`http://localhost:5173/` (`npm run dev`) con el backend en el puerto 8050.

Marque cada punto con ✅ o anote el problema.

## 1. Caso UNEMI completo → C

Datos de la tesis (Figs. 6.3–6.5; `docs/ANALISIS_GUIOS_ORIGINAL.md` §2.5). Calificaciones en el
orden en que aparecen los subfactores de cada factor.

| Factor | ID | Calificaciones | PM esperada | FODA esperada |
| :--- | :---: | :--- | :---: | :--- |
| Compatibilidad | 4 | 4 4 4 4 4 4 4 2 | 3.75 | Oportunidad |
| Personalización | 3 | 1 1 2 2 2 2 | 1.67 | Amenaza |
| Fiabilidad | 3 | 4 3 3 3 3 | 3.20 | Oportunidad |
| Reusabilidad | 2 | 3 3 | 3.00 | Oportunidad |
| Usabilidad | 3 | 4 3 4 3 | 3.50 | Oportunidad |
| Documentación | 3 | 3 3 3 3 2 2 2 2 2 2 2 | 2.36 | Amenaza |
| Mantenibilidad | 3 | 4 | 4.00 | Oportunidad |
| Portabilidad | 3 | 2 2 | 2.00 | Amenaza |
| Prueba | 3 | 3 | 3.00 | Oportunidad |
| Soporte (ámbito **Interno**) | 4 | 3 3 2 2 2 2 | 2.33 | Debilidad |
| Tiempo de adopción | 2 | 4 3 | 3.50 | Fortaleza |
| Formación | 3 | 3 3 3 2 | 2.75 | Debilidad |
| Casos de estudio de adopción FLOSS | 2 | 3 | 3.00 | Oportunidad |
| Centralidad de la tecnología de la información | 2 | 3 2 | 2.50 | Debilidad |
| Apoyo de la alta dirección | 3 | 4 | 4.00 | Fortaleza |
| Bloqueo de proveedores | 2 | 2 | 2.00 | Amenaza |
| Actitud hacia el cambio | 2 | 3 3 | 3.00 | Fortaleza |
| Coste total de propiedad | 3 | 4 3 | 3.50 | Fortaleza |

- [ ] En `/`, registrar "LibreOffice" / "UNEMI" y pulsar "Comenzar evaluación".
- [ ] Todo arranca sin calificar; la IS aparece en cada factor como referencia.
- [ ] Al elegir la ID se muestra la IR (p. ej., Usabilidad: IS 2 + ID 3 → IR 2 · Opcional).
- [ ] Cada clic muestra "Guardando…" y luego "Guardado".
- [ ] La lista de pendientes baja hasta "No falta nada" y se habilita "Generar dictamen".
- [ ] El dictamen es **C**: nombra a Personalización, Soporte y Formación con IR Importante, su PM y su
      FODA; separa "No cumple" de "No se sabe". No nombra a Documentación (IR Opcional).
- [ ] La matriz FODA tiene 4 Fortalezas, 3 Debilidades, 7 Oportunidades y 4 Amenazas, con títulos
      en texto (no solo color). La tabla muestra IS, ID, IR, PM y FODA de los 18 factores.

## 2. Guardado y recarga

- [ ] Calificar algunos subfactores, recargar la página (F5): los valores siguen ahí.
- [ ] Cerrar la pestaña y volver a `/`: la evaluación aparece en "Continuar una evaluación".
- [ ] Pulsar de nuevo un valor marcado lo deja "Sin calificar" y vuelve a contar como pendiente.
- [ ] Abrir la URL de la evaluación en otro navegador (o en ventana privada): aparece "Esta evaluación
      no está disponible en este navegador" y **no** lleva al login.

## 3. Fallos de red

- [ ] Con las herramientas del navegador en "Offline", cambiar una calificación: aparece "No se
      guardó" con "Reintentar" y un aviso.
- [ ] Volver a "Online" y pulsar "Reintentar": aparece "Guardado" y el valor queda en el backend
      (recargar para comprobarlo).
- [ ] Con el backend apagado, la cabecera muestra el nombre y logo por defecto, sin errores.

## 4. Evaluación cerrada y "Duplicar"

- [ ] Después del dictamen, abrir la URL de la estación: redirige a Resultados (solo lectura).
- [ ] "Duplicar" crea una evaluación nueva "En progreso" con las mismas ID, ámbito y calificaciones;
      la original sigue con su dictamen.
- [ ] Cambiar una calificación en la copia y generar su dictamen; la original no cambia.

## 5. Panel y sesión

- [ ] Con una sesión del panel caducada (cookie vencida), usar la evaluación pública: nada redirige al
      login ni intenta refrescar el token (pestaña Red: ninguna llamada a `/auth/token/refresh/`).
- [ ] El enlace "¿Eres administrador? Inicia sesión" lleva a `/login`; el panel funciona igual que antes.

## 6. Modo oscuro y accesibilidad

- [ ] El botón de luna/sol cambia entre claro y oscuro en las tres pantallas; todo se lee bien.
- [ ] Solo con teclado: Tab llega a cada grupo de botones; las flechas cambian el valor; Enter/Espacio
      en un botón marcado lo desmarca.
- [ ] Con un lector de pantalla, cada grupo se anuncia con su nombre (factor o criterio) y su valor.
- [ ] En un teléfono (≈ 390 px de ancho) las pantallas se usan sin desplazamiento horizontal.

## 7. Textos especiales

- [ ] Registrar "B&R Consultores" / "Ñandú & Cía.": se ven igual en la estación y en resultados.
- [ ] Un texto con etiquetas, p. ej. `<b>hola</b>`, se guarda sin las etiquetas ("hola"). Cualquier
      cosa entre `<` y `>` con forma de etiqueta se elimina (protección contra XSS del backend).
