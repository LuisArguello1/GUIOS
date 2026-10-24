# Prototipo de pantallas — GUIOS PRO

Diseño preliminar del Grupo 4 (24 pantallas). Es una **referencia visual** para programar el
frontend: muestra la estructura, los estilos y los textos de cada pantalla. No es código de
producción.

- Cada archivo se abre con doble clic en el navegador. Necesita internet: usa Tailwind por CDN,
  Google Fonts (Geist, JetBrains Mono, Material Symbols) y algunas imágenes externas.
- Los archivos no están enlazados entre sí. El flujo de navegación está en la Figura 1 del
  documento del Sprint 0 (mapa de navegación).
- El prefijo `figNN` es el número de figura en el documento del Sprint 0 (sección 6.3).

## Índice

| Archivo | Pantalla | Módulo | Requisitos | Historias |
|---|---|---|---|---|
| `fig02_registro.html` | Registro del software candidato | Público | RF-PUB-01, RF-PUB-06, RF-IA-01 | US-08 |
| `fig03_estacion.html` | Estación de evaluación (Pasos 1 a 4) | Público | RF-PUB-02 a RF-PUB-04, RF-IA-02, RF-IA-03 | US-09, US-10, US-13 |
| `fig04_resultados.html` | Resultados: FODA y dictamen (Pasos 5 y 6) | Público | RF-PUB-05, RF-IA-04 | US-11, US-14 |
| `fig05_ayuda.html` | Centro de ayuda metodológica | Público | RF-PUB-07 | US-09, US-10 |
| `fig06_login.html` | Inicio de sesión | Acceso | RF-ADM-01 a RF-ADM-03 | US-01 |
| `fig07_verificacion-2fa.html` | Verificación en dos pasos (2FA) | Acceso | RF-ADM-05 | US-01 |
| `fig08a_recuperar-1.html` | Recuperar contraseña: correo | Acceso | RF-ADM-04 | US-01 |
| `fig08b_recuperar-2.html` | Recuperar contraseña: código OTP | Acceso | RF-ADM-04 | US-01 |
| `fig08c_recuperar-3.html` | Recuperar contraseña: nueva contraseña | Acceso | RF-ADM-04 | US-01 |
| `fig09_tablero.html` | Tablero principal | Administrativo | RF-ADM-18, RF-ADM-19 | US-01 |
| `fig10_catalogo-dimensiones.html` | Catálogo: dimensiones | Administrativo | RF-ADM-20, RF-ADM-31 | US-06 |
| `fig11_catalogo-factores.html` | Catálogo: factores | Administrativo | RF-ADM-32 | US-06 |
| `fig12_catalogo-subfactores.html` | Catálogo: subfactores | Administrativo | RF-ADM-33 | US-06 |
| `fig13_catalogo-ventanas.html` | Catálogo: ventanas y regla RN-07 | Administrativo | RF-ADM-31 a RF-ADM-33 | US-06 |
| `fig14_historial.html` | Historial de evaluaciones | Administrativo | RF-ADM-21, RF-ADM-34, RF-ADM-36 | US-12 |
| `fig15_detalle.html` | Detalle de evaluación | Administrativo | RF-ADM-35 | US-12 |
| `fig16_usuarios.html` | Gestión de usuarios | Administrativo | RF-ADM-25, RF-ADM-28 | US-02 |
| `fig17_usuarios-ventanas.html` | Usuarios: ventanas | Administrativo | RF-ADM-06, RF-ADM-26, RF-ADM-27, RF-ADM-29, RF-ADM-30 | US-02 |
| `fig18_roles.html` | Roles y permisos | Administrativo | RF-ADM-12 a RF-ADM-17, RF-ADM-23 | US-03 |
| `fig19_roles-ventanas.html` | Roles: ventanas | Administrativo | RF-ADM-11 | US-03 |
| `fig20_organizacion.html` | Organización | Administrativo | RF-ADM-22 | US-04 |
| `fig21_menu.html` | Estructura del menú | Administrativo | RF-ADM-24 | US-03 |
| `fig22_auditoria.html` | Auditoría | Administrativo | RF-ADM-37 a RF-ADM-39 | US-05 |
| `fig23_perfil.html` | Mi perfil | Administrativo | RF-ADM-07 a RF-ADM-10 | US-02 |

## Cómo usarlo al programar

- El frontend real es React 19 + TypeScript + Tailwind 4. Hay que convertir cada pantalla en
  componentes. No copiar el script del CDN de Tailwind, la configuración inline ni los scripts
  de demostración que traen algunas páginas.
- Estilo base: modo oscuro neutro (fondo `#121212`, tarjetas `#1E1E24`, bordes `#33333B`,
  texto `#F4F4F5` / `#A1A1AA`, acento verde `#34D399`), tipografías Geist y JetBrains Mono,
  íconos Material Symbols. Detalle completo en la guía de estilo (Tabla 35 del documento).
- Las pantallas `fig13`, `fig17` y `fig19` son vistas comparativas de las ventanas modales. En
  la aplicación real esos modales se abren dentro de su pantalla (catálogo, usuarios y roles).
- `fig07` (2FA) y `fig23` (Mi perfil) las hizo el grupo con el mismo estilo; no vienen de Stitch.

## Reglas que ya están corregidas en las pantallas

- IR = ⌊(IS + ID) ÷ 2⌋ (Figura 5.10 de la tesis). Un factor es relevante si IR > 1.
- IS se llama **Importancia Sugerida** y sus valores son los de la Tabla 5.3.
- Dimensiones con 9, 8 y 1 factores; 18 factores y 61 subfactores.
- Dictamen con las letras de la tesis: A Adoptar, B Adoptar con matices, C Posponer.
  C prevalece sobre B. El caso de ejemplo (LibreOffice, UNEMI) da **C**: Soporte y Formación
  son Debilidades con IR 3 (Importante).

## Lo que NO hay que copiar de las pantallas

Si una pantalla contradice la tesis o las decisiones del equipo, mandan la tesis y las decisiones.

- Todos los datos son de ejemplo (LibreOffice, UNEMI, usuarios, fechas, porcentajes).
- Los controles aparecen ya marcados (ID y calificaciones). Se decidió que todo arranque
  "sin calificar".
- `fig05_ayuda`, `fig04_resultados` y `fig10_catalogo-dimensiones` tienen textos en inglés
  (Assessment, Telemetry, Rubric): traducirlos o quitarlos.
- `fig10_catalogo-dimensiones` muestra un "Peso relativo" por dimensión: GUIOS no usa pesos.
- `fig15_detalle` califica subfactores sobre 5 y muestra un "índice de madurez / 5.0": en GUIOS
  la escala es de 1 a 4.
