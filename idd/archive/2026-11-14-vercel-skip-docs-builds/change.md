# vercel-skip-docs-builds

## Intent and acceptance

Saltar la construcción en Vercel cuando un push solo cambia documentación

Acceptance: vercel.json declara un ignoreCommand que termina en 0 (construcción omitida) solo si existe un despliegue previo de la rama y nada fuera de docs/, idd/, openspec/ y archivos .md cambió desde él; en cualquier otro caso, incluido el primer push de una rama o un error de git, termina en 1 y se construye; se aplica también a main

## Plan

<!-- ospec:plan:start -->
- Files: `vercel.json`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Comparar contra VERCEL_GIT_PREVIOUS_SHA y no contra HEAD^: un push de varios commits no se salta por error
- Cualquier fallo del comando (sin despliegue previo, SHA ausente del clon) termina en 1 y construye: ante la duda, se despliega
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: check-run for checks-pass (2026-11-14T16:41:33.847Z)
- ev-2: check-run for checks-pass (2026-11-14T16:42:07.673Z)
- ev-3: frozen-review for trust-review (2026-11-14T16:42:50.027Z, subagent-stop)
- ev-4: check-run for checks-pass (2026-11-14T16:42:59.274Z)
- ev-5: adr-impact-declaration for adr-impact-declaration (2026-11-14T16:42:59.274Z)
- ev-6: living-doc-current for living-doc (2026-11-14T16:43:06.002Z)
<!-- ospec:evidence:end -->
