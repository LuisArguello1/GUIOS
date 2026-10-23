# Pruebas manuales — evaluación pública (Paso 6), panel (Paso 8), IA (Paso 10) y revisión final (Paso 11)

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

## 8. Panel administrativo (Paso 8)

Preparación: `setup_menus`, `setup_permissions` y `seed_guios_catalog`; un superusuario y un rol
"Lector GUIOS" con `dashboard.view`, `catalog.view` y `evaluations.view` (y los módulos del menú
Dashboard, Catálogo y Evaluaciones asignados al rol). Al menos una evaluación con dictamen.

- [ ] Tablero: el panel "Evaluaciones GUIOS" muestra total, en progreso, completadas, A/B/C con
      número y porcentaje, y las recientes; cada reciente abre su detalle.
- [ ] Catálogo (superusuario): crear una dimensión y un factor; el factor nace "Inactivo".
- [ ] Activar ese factor sin subfactores: el modal muestra "Un factor solo se puede activar si tiene
      al menos un subfactor activo." Agregar un subfactor y activarlo: funciona.
- [ ] En un factor base, el botón de eliminar está deshabilitado y dice "Es del catálogo base"; con
      Tab se llega al botón y el lector de pantalla lee el motivo. Al editarlo, la IS y el ámbito
      están bloqueados.
- [ ] Desactivar el único subfactor activo de un factor activo: el modal muestra el error del backend.
- [ ] Historial: cada filtro (software, organización, dictamen, estado, fechas) y su combinación;
      "Limpiar" quita todos; la paginación funciona con más de 20 evaluaciones.
- [ ] "Exportar CSV" descarga solo las filas filtradas; abrir el archivo en Excel o LibreOffice Calc
      (acentos correctos; un nombre que empieza con "=" no se ejecuta como fórmula).
- [ ] Detalle de una evaluación con dictamen: dice "Resultados y dictamen guardados", muestra el
      texto del dictamen, la matriz FODA, la tabla y las calificaciones; "PDF" descarga el detalle.
- [ ] Detalle de una evaluación en progreso: indica que se calcula y lista los pendientes.
- [ ] Con el rol "Lector GUIOS": no aparecen crear, editar, activar, eliminar, "Exportar CSV" ni "PDF".
- [ ] Auditoría: aparecen los cambios del catálogo con el usuario y las exportaciones (acción EXPORT).
- [ ] Modo oscuro y ancho de teléfono en las tres pantallas.

## 9. Asistencia de IA (Paso 10)

Requiere `ANTHROPIC_API_KEY` en el `.env` (cada prueba consume la API).

- [ ] Sin clave: el registro no muestra "Activar asistencia IA" y la estación, los resultados y el
      panel no muestran ningún control de IA. El caso UNEMI completo sigue dando C.
- [ ] Con clave: el interruptor está deshabilitado y dice el motivo hasta escribir la descripción o el
      repositorio; luego se puede activar.
- [ ] Estación: "Sugerir con IA" muestra una sugerencia por factor, con borde punteado y justificación;
      la ID sigue sin calificar. Aceptar guarda el valor; Cambiar cierra la sugerencia y lleva el foco
      a la escala; Ignorar la oculta sin guardar.
- [ ] "Sugerir calificaciones con IA" solo aparece en factores relevantes. "Aceptar todas las de este
      factor" pide confirmación y no cambia las calificaciones ya elegidas.
- [ ] Con una clave inválida o sin red: aparece un aviso claro y se puede seguir calificando a mano.
- [ ] Resultados: "Generar resumen con IA" muestra el resumen (y el plan en B o C) aparte del dictamen,
      con "Generado por IA · orientativo". "Regenerar" pide confirmación. El dictamen no cambia.
- [ ] Panel: el detalle muestra el informe de la IA y la tabla "Asistencia de IA" con las sugerencias
      aceptadas; el PDF incluye el resumen y el plan.

## 10. Revisión final (Paso 11)

- [ ] Usuarios: la columna "Roles" muestra los roles de cada usuario (no "Sin roles").
- [ ] Eliminar un usuario recién creado (sin actividad): el modal avisa del borrado permanente; al
      confirmar desaparece de la lista sin "Error al ejecutar la acción" (DELETE 200 con JSON).
- [ ] Eliminar un usuario que editó el catálogo o exportó evaluaciones: el modal dice que se
      desactivará y muestra el resumen (p. ej. "3 cambios en el catálogo GUIOS, 2 registros de
      auditoría"); al confirmar queda inactivo.
- [ ] Roles: eliminar un rol sin usuarios funciona y la lista se actualiza (DELETE 204 sin cuerpo).
- [ ] Catálogo: eliminar una dimensión, un factor y un subfactor creados a mano funciona sin error.
- [ ] `/api/docs/` (Swagger) muestra las rutas de login, 2FA, recuperación de contraseña, menú,
      organización y árbol de permisos.
