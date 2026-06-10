# Curso "El Ecosistema Erasmus+" — Manual de generación para Claude Local

> Documento de trabajo de **EU Funding School**. Reúne todo lo acordado para que Claude Local genere, lección a lección, el material del curso "El Ecosistema Erasmus+", listo para alojarse en **Moodle**.

---

## 0 · Cómo usar este documento

Este `.md` es el **manual de operación + prompt maestro + plan de lecciones + lección de referencia**.

**Claude Local recibe:**
1. Este documento.
2. La **Guía del Programa Erasmus+ 2026** (fuente autorizada del proyecto).
3. Las **lecciones ya generadas** anteriormente (para mantener la continuidad).

**Por cada lección del plan (sección 10), Claude Local genera:**
- el **artículo** en `.html` (para una "Página" de Moodle),
- la **autoevaluación** en `.txt` formato GIFT (para el Banco de preguntas de Moodle),
- *(opcional)* una **pieza de captación** en `.txt`.

La **lección 1.1 (sección 11)** es el patrón de oro: tono, estructura y formato a replicar.

---

## 1 · Contexto y misión

- **Curso:** "El Ecosistema Erasmus+". Formación online de **60 horas / 60 lecciones**, alojada en Moodle, dirigida a personas que **parten de cero**.
- **Naturaleza:** curso transversal (de "acercamiento" al programa). Cubre la lógica común a cualquier convocatoria (Guía Partes A, C y D) y recorre la Parte B **a nivel de panorámica**; el detalle de cada acción concreta vive en los cursos específicos por convocatoria.
- **Doble fin de todo contenido:** (1) enseñar con rigor; (2) servir de base para piezas de captación de EU Funding School. **El segundo fin es siempre secundario** y nunca contamina el artículo.

---

## 2 · Fuentes y rigor

- La **Guía Erasmus+ 2026** del proyecto es la **fuente autorizada**. Cita siempre la **Parte/sección** en que te apoyas (p. ej. "Parte A").
- Si la Guía **no cubre** algo o hay ambigüedad, **dilo**; no inventes.
- El **Grant Agreement** y la **convocatoria concreta** **prevalecen** sobre la Guía general; recuérdalo cuando aplique.
- Marca con **⚠️VERIFICAR-AÑO** todo dato sensible al tiempo (presupuestos anuales, plazos, Call ID, importes, umbrales, prioridades del año).
- **No** des asesoramiento legal vinculante: explica la norma y remite a la fuente oficial.
- **Idioma:** español. Los términos técnicos y nombres oficiales se mantienen en su **idioma original** (Call ID, Topic ID, PIC, OID, EU Login, Funding & Tenders Portal, lump sum, unit costs, Annual Work Programme, VET, Declaration on Honour…), explicados al vuelo la primera vez.

---

## 3 · La unidad-lección = 1 hora

Cada lección es una unidad de **~1 hora**:

`artículo (~8-10 min de lectura) + estudio/relectura + 1-2 materiales extra + autoevaluación (10 preguntas)`

60 lecciones de 1 hora = 60 horas. El **PAC** (actividad práctica) es la **lección de cierre de cada módulo**.

---

## 4 · Esquema de lección (v2): ficha + artículo

### A) Ficha técnica (cabecera breve, **no visible para el alumno**)
Va como **comentario HTML** al inicio del artículo, para trazabilidad:
- Curso · Módulo · Nº de lección · Título
- **Idea central** (1 frase): lo único que enseña la lección
- **Al terminar, el alumno podrá…** (1 frase)
- **Por qué importa** (1 frase)
- **Referencia Guía** (Parte/sección)
- **⚠️VERIFICAR-AÑO**: datos que caducan

### B) El artículo (lo que lee el alumno)
Reglas en la sección 5.

---

## 5 · Estilo de redacción del artículo

- **UNA sola idea por lección.** Si asoma una segunda idea grande, no la metas: pertenece a otra lección.
- Es un **artículo que fluye**, no un formulario por bloques. **Prohibido** encabezar el texto con etiquetas tipo "Qué vas a aprender / Errores comunes / En resumen". Esas intenciones se **tejen** en la prosa.
- **Arco natural:** engancha (un dato concreto y verificado de la Guía, o una situación cotidiana) → desarrolla la idea con aclaraciones y ejemplos → cierra con una conclusión clara y un **puente a la lección siguiente**.
- **Tono:** cercano, sencillo, instructivo. Habla de **"tú"**. Frases cortas. Explica como a alguien que empieza de cero. **Sin jerga ni coloquialismos.**
- **Distingue de forma natural** (sin etiquetas): lo que dice la Guía / lo que es recomendación / lo que el alumno debe verificar en su convocatoria.
- **Longitud:** 900-1.200 palabras.
- Cierra con una frase memorable.

---

## 6 · Reglas permanentes (innegociables)

1. **UNA idea = un aprendizaje** por lección.
2. **REPRESENTACIÓN.** A lo largo del curso, los ejemplos deben reflejar a **todos** los destinatarios —**centros escolares, universidades, asociaciones/juventud y empresas/centros de FP (VET)**— para que cualquier lector se vea reflejado. Siempre que encaje, incluye el vínculo **educación → mundo laboral** y el **papel de las empresas** formando a sus futuros trabajadores a través de la VET.
3. **CONTINUIDAD.** Ten en cuenta las lecciones anteriores: retoma en una frase lo ya visto cuando ayude, **no repitas** explicaciones ya dadas y **conecta** el cierre con la siguiente. El curso debe leerse como **un hilo continuo**.

---

## 7 · Autoevaluación y ajustes de Moodle

### Autoevaluación (la genera Claude Local, en GIFT)
- **10 preguntas** por lección, que evalúen LA idea de la lección desde varios ángulos.
- Tipo test (opción única). Cada pregunta vale **1 punto**.
- Cada opción con **retroalimentación** (`#`) que **enseñe**, no solo que corrija.
- El archivo empieza con un comentario `//` indicando lección y categoría Moodle sugerida.

### Ajustes de la actividad Cuestionario (se configuran en Moodle, **idénticos en todas las lecciones**)
- Intentos permitidos: **Ilimitado**
- Método de calificación: **Calificación más alta**
- Calificación para aprobar (*Grade to pass*): **5,00** sobre 10 (= 5 aciertos)
- Desbloqueo de la siguiente lección: **Finalización de actividad** ("aprobar") + **Restricción de acceso** en el recurso siguiente

> Nota: el número de preguntas se controla en el GIFT; el aprobado y los intentos **no** van en el GIFT, sino en los ajustes de la actividad.

---

## 8 · Formato de salida y nomenclatura

**Por lección, tres archivos:**

**A) Artículo → `.html`** (listo para pegar en una "Página" de Moodle)
- HTML limpio y mínimo: `<h2>` para el título, `<h3>` si hace falta, `<p>`, `<ul>/<li>`, `<strong>`. **Sin** estilos en línea, **sin** clases, **sin** `<html>`/`<body>`.
- Al inicio, la **ficha técnica** como comentario HTML (`<!-- ... -->`), invisible al alumno.
- Al final, una sección `<h3>Para seguir aprendiendo</h3>` con los 1-2 materiales extra.

**B) Autoevaluación → `.txt` (GIFT)**, importable en Moodle (Banco de preguntas → Importar → GIFT).

**C) *(Opcional)* Pieza de captación → `.txt`**: un párrafo (gancho + beneficio + CTA a EU Funding School). **Nunca** dentro del artículo.

**Nomenclatura:**
- Artículo: `M{módulo}_L{lección}_{slug}.html` → `M1_L1-1_que-es-erasmus.html`
- Autoevaluación: `M{módulo}_L{lección}_quiz.gift.txt` → `M1_L1-1_quiz.gift.txt`
- Captación: `M{módulo}_L{lección}_captacion.txt`

> Para casos que necesiten retroalimentación general, categorías automáticas o preguntas complejas, **Moodle XML** es una alternativa a GIFT (más potente, más verbosa). GIFT es el formato por defecto.

---

## 9 · Checklist antes de dar por buena una lección

- [ ] ¿Hay **UNA** sola idea clara?
- [ ] ¿El texto **fluye** como artículo, sin bloques etiquetados?
- [ ] ¿Aparece algún destinatario y, a lo largo del módulo, se cubren los **cuatro sectores**?
- [ ] ¿**Conecta** con la lección anterior y **abre** la siguiente?
- [ ] ¿**Cita** la Parte/sección de la Guía y marca **⚠️VERIFICAR-AÑO** donde toca?
- [ ] ¿El artículo tiene 900-1.200 palabras y tono cercano?
- [ ] ¿El quiz GIFT tiene **10 preguntas** válidas con retroalimentación que enseña?

---

## 10 · Plan de las 60 lecciones

> 1 lección = 1 idea = 1 hora. El **PAC** es la lección práctica de cierre de cada módulo. Los datos sensibles al año se concentran en M6, M7 y M8.

### Módulo 1 · Qué es Erasmus+ y cómo leer las Guías (7)
- 1.1 Qué es Erasmus+ y por qué existe ✅ *(ya redactada — ver sección 11)*
- 1.2 Los objetivos del programa: la brújula que hace que un proyecto "encaje"
- 1.3 Un programa vivo: el Reglamento, la Call anual y el Annual Work Programme
- 1.4 Los valores de la UE: una condición para participar, no un adorno
- 1.5 Cómo está organizada la Guía 2026: Partes A, B, C y D
- 1.6 Cómo navegar la Guía y apoyarte en el glosario (Parte D)
- 1.7 **PAC** · Tu primer mapa: localizar objetivos, una acción y términos clave

### Módulo 2 · Las prioridades del programa (6)
- 2.1 Qué son las prioridades y por qué deciden lo que se financia
- 2.2 Inclusión y diversidad: las personas con *fewer opportunities*
- 2.3 Sostenibilidad medioambiental: la transición verde en los proyectos
- 2.4 Transformación digital
- 2.5 Participación democrática, valores comunes y compromiso cívico
- 2.6 **PAC** · Detectar las prioridades en un proyecto de ejemplo

### Módulo 3 · El mapa de la Parte B: los tipos de programa (11)
- 3.1 Cómo se lee la "ficha" de una acción (objetivos, actividades, criterios, financiación)
- 3.2 KA1 Movilidad: qué es y qué persigue
- 3.3 KA1 por sectores: escolar, FP/VET, superior, adultos y juventud
- 3.4 KA1 otras formas: acreditaciones, participación juvenil, DiscoverEU, intercambios virtuales y deporte
- 3.5 KA2 Cooperación: cooperar para innovar y transferir
- 3.6 KA2 Partnerships for Cooperation: Cooperation y Small-scale Partnerships
- 3.7 KA2 Excellence e Innovation: Centres of Vocational Excellence, Erasmus Mundus y Alliances for Innovation
- 3.8 KA2 Capacity Building y *Not-for-profit European sport events*
- 3.9 KA3 Apoyo a las políticas: European Youth Together
- 3.10 Jean Monnet: enseñar e investigar sobre la UE
- 3.11 **PAC** · Clasificar ideas de proyecto en su acción correcta

### Módulo 4 · Quién gestiona Erasmus+ (5)
- 4.1 Las dos puertas: gestión directa (EACEA) vs indirecta (Agencias Nacionales)
- 4.2 La Comisión Europea y el ciclo del programa
- 4.3 EACEA: qué gestiona y qué implica para ti
- 4.4 Las Agencias Nacionales y la red de apoyo (SALTO, Eurodesk, NEOs)
- 4.5 **PAC** · ¿A quién acudo según mi proyecto?

### Módulo 5 · Quién puede participar (6)
- 5.1 Países del programa y terceros países (asociados / no asociados, regiones)
- 5.2 Qué organizaciones son elegibles
- 5.3 El consorcio: coordinador y socios
- 5.4 *Associated partners*: el papel de las empresas y agentes no educativos
- 5.5 Personas físicas y grupos informales: cuándo sí y cuándo no
- 5.6 **PAC** · Comprobar la elegibilidad de un consorcio

### Módulo 6 · El dinero: presupuesto y financiación (7)
- 6.1 El presupuesto del programa, a grandes rasgos
- 6.2 Los modelos de financiación: *lump sum*, *unit costs*, costes reales y mixto
- 6.3 *Lump sum*: financiar por resultados y *work packages*
- 6.4 *Unit costs* y costes reales: cuándo se usa cada uno
- 6.5 Categorías de coste y cofinanciación: qué cubre el programa
- 6.6 Coherencia presupuesto–actividades–resultados: el dinero cuenta una historia
- 6.7 **PAC** · Leer e interpretar una tabla de presupuesto

### Módulo 7 · Plataformas y herramientas europeas (9)
- 7.1 El Funding & Tenders Portal: tu base de operaciones
- 7.2 EU Login: tu llave de acceso
- 7.3 Registrar tu organización (I): el PIC para acciones de EACEA
- 7.4 Registrar tu organización (II): el OID para Agencias Nacionales
- 7.5 Mantener la documentación al día
- 7.6 Encontrar tu convocatoria: Call ID y Topic ID
- 7.7 El formulario: descarga, partes A y B, y envío
- 7.8 Si algo falla: plazos, evidencias y servicios de asistencia
- 7.9 **PAC** · Recorrido guiado del Portal (alta + búsqueda de convocatoria)

### Módulo 8 · Evaluación y cumplimiento (9)
- 8.1 Cómo se evalúa una candidatura: el papel de los expertos
- 8.2 Los criterios de adjudicación: relevancia, calidad, consorcio e impacto
- 8.3 Umbrales y puntuación: por qué se rechaza una propuesta
- 8.4 *Exclusion* y *selection criteria*: capacidad y fiabilidad del solicitante
- 8.5 El Reglamento Financiero de la UE: las reglas del dinero europeo
- 8.6 La *Declaration on Honour* y el conflicto de intereses
- 8.7 El Grant Agreement: por qué prevalece y a qué te compromete
- 8.8 Glosario esencial y cierre del mapa del ecosistema (Parte D)
- 8.9 **PAC** · Checklist de cumplimiento + autoevaluación final

**Total: 60 lecciones = 60 horas.**

---

## 11 · Lección de referencia (patrón de oro): 1.1

### 11.A · Artículo (`M1_L1-1_que-es-erasmus.html`)

```html
<!-- FICHA
Curso: El Ecosistema Erasmus+
Módulo 1 · Lección 1.1
Título: ¿Qué es Erasmus+ y por qué existe?
Idea central: Erasmus+ es el gran programa europeo de aprendizaje en cuatro ámbitos, mucho más amplio que la idea de "irse de Erasmus".
Al terminar, el alumno podrá: explicar qué es Erasmus+, en qué cuatro ámbitos actúa y con qué espíritu nació.
Por qué importa: es el cimiento sobre el que se apoya todo el curso.
Referencia Guía: Parte A — What is Erasmus+.
VERIFICAR-AÑO: el presupuesto anual se fija cada año en el Annual Work Programme.
-->

<h2>¿Qué es Erasmus+ y por qué existe?</h2>

<p>Di la palabra "Erasmus" en voz alta y casi todo el mundo piensa en lo mismo: un universitario que se va un semestre a otro país, comparte piso con gente de media Europa y vuelve hablando un idioma nuevo. Esa imagen no es falsa. Pero es una esquina diminuta de algo mucho más grande.</p>

<p>Erasmus+ es el programa de la Unión Europea para la <strong>educación, la formación, la juventud y el deporte</strong>. Cuatro ámbitos, no uno. Y para que te hagas una idea de su tamaño: maneja un presupuesto de <strong>más de 26.000 millones de euros</strong> entre 2021 y 2027, y lleva más de 35 años funcionando. No es una beca. Es una de las grandes políticas de la Unión Europea.</p>

<p>Esto es lo primero que quiero que te lleves, porque lo cambia todo: cuando entiendas que Erasmus+ no va solo de movilidad universitaria, se te abre un mapa de posibilidades enorme. Vamos a verlo.</p>

<p>Esos cuatro ámbitos no son etiquetas vacías. Detrás de cada uno hay personas y organizaciones muy distintas. En <strong>educación y formación</strong> caben desde una universidad que envía a sus estudiantes y profesores al extranjero, hasta un instituto que quiere que sus docentes aprendan nuevas metodologías, o un centro de Formación Profesional que lleva a sus alumnos a hacer prácticas en empresas de otro país. En <strong>juventud</strong> entra una asociación pequeña que reúne a chavales de varios países para trabajar juntos sobre un tema que les importa. Y en <strong>deporte</strong> caben proyectos que usan el deporte de base para integrar o para formar mejor a los entrenadores. Gente normal, organizaciones normales. No hace falta ser una gran institución.</p>

<p>¿Y por qué existe todo esto? Aquí conviene ir a la fuente. La Guía del Programa lo explica en su Parte A, y merece la pena leerlo despacio: la idea de fondo es el <strong>lifelong learning</strong>, el aprendizaje a lo largo de toda la vida. La ambición, dicha casi con todas las letras, es que pasar un tiempo en otro país para estudiar, formarte o trabajar deje de ser algo excepcional y se convierta en <strong>lo normal</strong>. Erasmus+ existe para que aprender, moverte y colaborar con personas de otros países esté al alcance de cualquiera, no solo de unos pocos.</p>

<p>Y existe también por una razón más profunda. La propia Guía conecta el programa con construir una Europa más cohesionada, más verde y más preparada para lo digital; con dar a la gente las competencias que necesita en un mundo que cambia rápido; y muy especialmente con algo que toca a todos: <strong>el paso de la educación al mundo laboral</strong>. Dicho de forma sencilla: Europa invierte en que sus ciudadanos crezcan aprendiendo y encuentren su sitio en el mercado de trabajo, porque de ahí salen sociedades más fuertes. Ese es el "para qué".</p>

<p>Hay un detalle más que te ahorrará disgustos desde el primer día. Erasmus+ no es un texto grabado en piedra. Se apoya en un reglamento europeo y se concreta cada año en un documento llamado <strong>Annual Work Programme</strong>, donde se fijan el presupuesto disponible y las prioridades de ese año. ¿Qué significa para ti? Que el programa es un ser vivo: la cifra de 26.000 millones es del periodo completo y es estable, pero lo que hay disponible cada año y los temas que se priorizan <strong>cambian</strong>. Así que, antes de preparar nada, acostúmbrate a comprobar siempre la convocatoria y los documentos del año en curso. Es una costumbre pequeña que separa a quien sabe moverse de quien trabaja con información caducada.</p>

<p>Para que veas lo amplio que es esto, déjame ponerte dos ejemplos de mundos muy distintos.</p>

<p>El primero, una asociación juvenil de un pueblo que reúne a un grupo de adolescentes con jóvenes de otros tres países para trabajar juntos sobre cómo detectar noticias falsas. A primera vista parece "una actividad bonita". Pero fíjate: encaja de lleno en el ámbito de <strong>juventud</strong>, responde a esa idea de movilidad y participación, y toca un tema que a Europa le preocupa de verdad.</p>

<p>El segundo, en un mundo completamente distinto. Piensa en un centro de Formación Profesional —lo que en Europa se llama <strong>VET</strong>, <em>Vocational Education and Training</em>— que prepara a futuros técnicos. En el aula puede enseñar mucho, pero hay un salto que cuesta dar: el que va de los estudios al primer trabajo de verdad. Y ahí entran las <strong>empresas</strong>. A través de Erasmus+, ese centro puede enviar a sus alumnos a hacer prácticas en talleres y empresas de otro país, y sentarse con compañías —de aquí y de allí— para decidir juntos qué competencias pide realmente el mercado. Las empresas dejan de ser espectadoras y pasan a <strong>formar a sus futuros trabajadores</strong>: el alumno gana experiencia real, la empresa gana talento mejor preparado, y ese puente entre la educación y el empleo se vuelve sólido.</p>

<p>Fíjate en el recorrido: un instituto, una universidad, una asociación de pueblo y una empresa caben en el mismo programa. Sin saberlo, todas ellas ya están hablando el idioma de Erasmus+. Sea cual sea tu punto de partida, hay una puerta para ti. Y ese es exactamente el clic que estás empezando a hacer tú.</p>

<p>Así que quédate con esto: Erasmus+ es una herramienta para que personas y organizaciones crezcan aprendiendo, en cuatro ámbitos, y forma parte de un proyecto europeo mucho más grande. No es "irse de Erasmus": es un universo de oportunidades del que la movilidad universitaria es solo la punta.</p>

<p>En la siguiente lección damos el paso natural: si esto es lo que <strong>es</strong> el programa, ¿qué se propone conseguir exactamente? Veremos sus objetivos, que son la brújula que después usarás para que tus proyectos encajen.</p>

<h3>Para seguir aprendiendo</h3>
<ul>
  <li>Vídeo institucional "What is Erasmus+".</li>
  <li>Guía del Programa Erasmus+ 2026, primeras páginas de la Parte A.</li>
</ul>
```

### 11.B · Autoevaluación (`M1_L1-1_quiz.gift.txt`)

```
// Autoevaluación · Lección 1.1 — ¿Qué es Erasmus+ y por qué existe?
// Categoría Moodle sugerida: Ecosistema Erasmus+/Módulo 1/Lección 1.1
// Aprobado: 5/10 · Intentos: ilimitados (se configuran en la actividad Cuestionario)

::1.1-P1 ¿Qué es Erasmus+?::
¿Qué es, en esencia, Erasmus+?{
=El programa de la Unión Europea para la educación, la formación, la juventud y el deporte.#Correcto. Actúa en esos cuatro ámbitos: es mucho más que la movilidad universitaria.
~Una beca exclusiva para universitarios que estudian un semestre fuera.#No. Esa es solo una pequeña parte de uno de los cuatro ámbitos.
~Un programa que financia únicamente la movilidad de estudiantes.#No. También financia cooperación, formación, juventud y deporte.
~Una organización internacional independiente de la Unión Europea.#No. Es un programa de la propia UE, basado en un reglamento europeo.
}

::1.1-P2 Los cuatro ámbitos (I)::
¿Cuál de los siguientes NO es uno de los cuatro ámbitos de Erasmus+?{
~Educación#Sí lo es.
~Formación#Sí lo es.
~Juventud#Sí lo es.
=Investigación e innovación tecnológica#Correcto. La investigación se financia sobre todo vía Horizonte Europa. Los ámbitos son educación, formación, juventud y deporte.
}

::1.1-P3 ¿Quién puede participar?::
Señala la afirmación correcta sobre Erasmus+.{
=Pueden participar centros escolares, universidades, asociaciones y también empresas y centros de FP (VET).#Correcto. Está abierto a perfiles muy distintos, y las empresas tienen un papel clave a través de la VET.
~Solo pueden participar las universidades.#No. Es un error muy común; participan muchos otros tipos de organización.
~Las empresas no pueden tener ningún papel en Erasmus+.#No. Colaboran, por ejemplo, acogiendo prácticas de alumnos de FP.
~El programa es idéntico cada año, así que no hace falta revisar nada.#No. El presupuesto y las prioridades se fijan cada año.
}

::1.1-P4 Los cuatro ámbitos (II)::
Los cuatro ámbitos en los que actúa Erasmus+ son:{
=Educación, formación, juventud y deporte.#Correcto.
~Educación, investigación, cultura y deporte.#No. Investigación y cultura tienen sus propios programas.
~Universidad, empresa, deporte y turismo.#No.
~Educación, sanidad, empleo y juventud.#No.
}

::1.1-P5 La idea de fondo::
¿Qué idea vertebra el programa según la Guía?{
=El aprendizaje a lo largo de toda la vida (lifelong learning).#Correcto.
~La competición entre universidades europeas.#No.
~La financiación de obras e infraestructuras educativas.#No, el programa no financia obras.
~El intercambio comercial entre países.#No, eso no es Erasmus+.
}

::1.1-P6 La ambición del programa::
¿Cuál es una de las grandes ambiciones de Erasmus+?{
=Que pasar un tiempo en otro país para aprender, formarse o trabajar llegue a ser algo normal y no excepcional.#Correcto, así lo expresa la propia Guía.
~Que solo los mejores expedientes accedan a la movilidad.#No, busca lo contrario: ampliar el acceso.
~Reducir todos los programas europeos a uno solo.#No.
~Sustituir a los sistemas educativos nacionales.#No, los complementa.
}

::1.1-P7 El tamaño del programa::
La cifra de más de 26.000 millones de euros corresponde a...{
=El presupuesto indicativo de todo el periodo 2021-2027.#Correcto. Es del periodo completo y es estable.
~El presupuesto de un solo año.#No. El presupuesto anual es menor y se fija cada año.
~El dinero que recibe cada país.#No.
~El importe máximo de una beca individual.#No.
}

::1.1-P8 Un programa vivo::
¿Por qué conviene comprobar siempre los documentos del año en curso antes de preparar una candidatura?{
=Porque el presupuesto disponible y las prioridades se fijan cada año en el Annual Work Programme y pueden cambiar.#Correcto.
~Porque la Guía cambia de idioma cada año.#No.
~Porque el programa caduca cada diciembre.#No.
~Porque no hace falta: la información no cambia nunca.#No, justo lo contrario.
}

::1.1-P9 El papel de las empresas::
En la Formación Profesional (VET), ¿qué papel pueden tener las empresas?{
=Colaborar y formar a futuros trabajadores, por ejemplo acogiendo prácticas de alumnos en otro país.#Correcto. Ayudan a tender el puente entre la educación y el empleo.
~Ninguno: las empresas no participan en Erasmus+.#No, sí participan.
~Solo aportar dinero al programa.#No.
~Sustituir a los centros educativos.#No, colaboran con ellos.
}

::1.1-P10 Más que movilidad universitaria::
¿Cuál de estas afirmaciones describe mejor a Erasmus+?{
=Es un amplio programa europeo de aprendizaje del que la movilidad universitaria es solo una parte.#Correcto.
~Es exclusivamente un programa de movilidad de estudiantes universitarios.#No, es el error más frecuente.
~Es una ONG dedicada al voluntariado juvenil.#No.
~Es un programa centrado solo en el deporte profesional.#No.
}
```

### 11.C · Pieza de captación opcional (`M1_L1-1_captacion.txt`)

```
¿Sabías que Erasmus+ mueve más de 26.000 millones de euros y no es solo "irse de Erasmus"?
Entender cómo funciona el programa es el primer paso para conseguir financiación europea.
Aprende a hacerlo paso a paso en EU Funding School.
```

---

*Documento de EU Funding School · Curso "El Ecosistema Erasmus+" · Manual para Claude Local.*
