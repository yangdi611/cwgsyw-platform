# Third-Party Software Notices

This file applies to the cwgsyw-platform source repository and its distributed
artifacts. It is informational and does not replace or modify any third-party
license.

## License boundary

Original cwgsyw-platform code is licensed under the MIT License in `LICENSE`.
Third-party software is **not relicensed under the cwgsyw-platform MIT
License**. Each third-party component remains governed by its own copyright
notices, license terms, attribution requirements, source-offer requirements,
and warranty disclaimers.

When redistributing source code, compiled applications, standalone frontend
bundles, executable JAR files, container images, or modified third-party
components, distributors must preserve all notices and license texts required
by the applicable upstream licenses.

This inventory was reviewed on 2026-07-28 against `frontend/package-lock.json`,
`backend/pom.xml`, the Maven runtime dependency graph, the application
Dockerfiles, and `docker-compose.prod.yml`. Lockfiles and resolved dependency
metadata are authoritative for exact transitive versions.

## Frontend direct production dependencies

| Component | Resolved version | Declared license |
| --- | ---: | --- |
| @base-ui/react | 1.5.0 | MIT |
| @bpmn-io/properties-panel | 3.44.0 | MIT |
| @tanstack/react-query | 5.100.11 | MIT |
| @uiw/react-md-editor | 4.1.1 | MIT |
| @xyflow/react | 12.10.2 | MIT |
| axios | 1.16.1 | MIT |
| bpmn-js | 18.16.1 | bpmn.io License; MIT-derived with mandatory visible watermark condition |
| bpmn-js-properties-panel | 5.58.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| clsx | 2.1.1 | MIT |
| cmdk | 1.1.1 | MIT |
| docx-preview | 0.3.7 | Apache-2.0 |
| highlight.js | 11.11.1 | BSD-3-Clause |
| html-to-image | 1.11.13 | MIT |
| konva | 10.3.0 | MIT |
| lucide-react | 1.16.0 | ISC |
| mermaid | 11.16.0 | MIT |
| next | 16.2.6 | MIT |
| next-themes | 0.4.6 | MIT |
| react | 19.2.4 | MIT |
| react-dom | 19.2.4 | MIT |
| react-hook-form | 7.76.0 | MIT |
| react-konva | 19.2.5 | MIT |
| react-markdown | 10.1.0 | MIT |
| recharts | 3.10.0 | MIT |
| rehype-highlight | 7.0.2 | MIT |
| remark-breaks | 4.0.0 | MIT |
| remark-gfm | 4.0.1 | MIT |
| shadcn | 4.7.0 | MIT |
| sonner | 2.0.7 | MIT |
| tailwind-merge | 3.6.0 | MIT |
| tw-animate-css | 1.4.0 | MIT |
| xlsx | 0.18.5 | Apache-2.0 |
| zustand | 5.0.13 | MIT |

The frontend production dependency graph also contains transitive components
under MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0,
CC0-1.0, CC-BY-4.0, Python-2.0, Unlicense, Zlib, MPL-2.0 and
LGPL-3.0-or-later terms. Platform-specific Sharp/libvips packages are among
the LGPL-licensed artifacts selected by npm for supported targets. Only the
packages actually copied into a target-specific production image are part of
that image's distribution.

### bpmn-js mandatory condition

The `bpmn-js` license requires the source code responsible for displaying the
bpmn.io project watermark, including its link to <https://bpmn.io>, not to be
removed or changed. In a website or application, the watermark must remain
fully visible and must not be visually overlapped. Consult the exact license
shipped with the resolved `bpmn-js` package before modifying or distributing
the BPMN renderer.

## Backend direct production dependencies

| Component or family | Resolved version | Declared license or choice |
| --- | ---: | --- |
| Spring Boot and Spring Framework | 3.4.5 / 6.2.6 | Apache-2.0 |
| Spring Security | 6.4.5 | Apache-2.0 |
| Spring Data Redis | 3.4.5 | Apache-2.0 |
| MyBatis-Plus | 3.5.12 | Apache-2.0 |
| PostgreSQL JDBC Driver | 42.7.5 | BSD-2-Clause |
| Flyway | 10.20.1 | Apache-2.0 |
| JJWT | 0.12.6 | Apache-2.0 |
| Flowable | 7.1.0 | Apache-2.0 |
| Apache POI | 5.3.0 | Apache-2.0 |
| OpenPDF | 2.0.3 | LGPL-2.1-or-later or MPL-2.0; comply with the selected license |
| MinIO Java SDK | 8.5.11 | Apache-2.0 |
| Apache Commons CSV | 1.11.0 | Apache-2.0 |
| juniversalchardet | 1.0.3 | MPL-1.1 |

Backend transitive runtime dependencies include additional Apache-2.0, MIT,
BSD, Eclipse Distribution License, Eclipse Public License, MPL, LGPL and other
permissive or weak-copyleft components. Notable examples include Logback
(EPL-1.0 or LGPL), JSQLParser (Apache-2.0 or LGPL-2.1), Jakarta APIs under
their declared license choices, and OpenPDF under LGPL/MPL terms. Maven POM
metadata and the license files embedded in the resolved JARs are authoritative.

## Container images and operating-system packages

The deployment uses or may redistribute the following independently licensed
software. Their image layers, binaries and packages are not covered by the
cwgsyw-platform MIT License.

| Software | Referenced version | Distribution role |
| --- | ---: | --- |
| Node.js Alpine image | 22-alpine | frontend build and runtime |
| Eclipse Temurin Alpine image | 21-jdk / 21-jre | backend build and runtime |
| Alpine Linux packages | image-selected | Maven, fonts, Pandoc, PostgreSQL client and tar |
| PostgreSQL image | 16-alpine | database service |
| Redis image | 7-alpine | cache and session service |
| MinIO image | latest | object-storage service |
| NGINX Alpine image | alpine | reverse proxy |

Before redistributing container images, review the notices and license files
inside every final image, including operating-system packages and bundled
fonts. Floating tags such as `latest` and `alpine` must be resolved to immutable
digests for a reproducible compliance inventory.

## Distribution requirements

1. Ship `LICENSE` and this file with every source or binary distribution.
2. Preserve upstream copyright, attribution, `LICENSE`, `NOTICE`, source-offer,
   relinking and modification notices required by each included component.
3. Preserve the bpmn.io watermark exactly as required by the resolved
   `bpmn-js` license.
4. For LGPL/MPL/EPL components, review whether the distributed form or any
   local modifications trigger source-code, replacement, relinking or
   file-level disclosure obligations.
5. Regenerate the dependency inventory after every lockfile, Maven dependency,
   base-image or operating-system package change.
6. Do not describe third-party components or an entire container image as
   being licensed solely under MIT.

No trademark rights or patent rights beyond those expressly granted by an
applicable license are granted by the cwgsyw-platform MIT License.
