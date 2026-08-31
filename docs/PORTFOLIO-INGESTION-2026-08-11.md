# Portfolio ingestion report

Date: 2026-08-11  
Status: Local internal-review draft. Not cleared for public release.

## Intake summary

### Geely Australia

- 52 JPEG photographs, approximately 687 MB.
- Image dimensions range from 1934 × 1448 to 8381 × 5368.
- Predominantly 3:2 landscape, with square and portrait variants.
- 52 unique SHA-256 hashes. No exact photograph duplicates detected.
- 14 reviewed video deliverables across EE Show, Melbourne Show and the 10,000-vehicle delivery project family.
- Selected film: 71.64-second 1920 × 1080 Australia launch master, converted to a 480p web derivative.

Selected stills:

1. `DSCF7088`: hero-scale vehicle portrait with Sydney Harbour and the Opera House.
2. `DJI_20240220013759_0135_D`: wide coastal driving image with strong movement and negative space.
3. `DSCF7063`: city and vehicle composition with the Opera House framed by the street.
4. `DSC_2179`: family arrival scene that adds people and use context.
5. `_DSC9709`: family lifestyle frame that complements the wider automotive imagery.

The set was chosen to balance brand visibility, environment, motion, people, wide layouts and portrait-friendly cropping without repeating the same angle.

### Stasis Clinic

- 10 video files, approximately 436 MB.
- Selected master: 102.42-second 1920 × 1080 brand film, converted to a 480p web derivative.
- Supporting stills were extracted from visually reviewed representative frames at 20%, 40%, 60% and 80% of the film.
- Low-resolution legacy MOV versions and visually redundant treatment variants were excluded.

The selected sequence covers the interior, equipment, clinical treatment and hands-on facial service without making medical or efficacy claims.

### Molly Tea

No Molly Tea source was present under `10-资产管理` during the first pass. The later Dropbox intake supplied two horizontal opening films; `Green Sq.mov` is now the selected internal-review source and the alternate remains staged.

## Web derivatives

- Geely: five JPEGs at a maximum long edge of 2200–2400 px, plus one 480p M4V film.
- Molly Tea: one extracted JPEG poster plus the selected supplied `.mov` opening film; the overlapping alternate remains in the pending-review archive.
- Stasis: four JPEG frames at a maximum long edge of 1800 px, plus one 480p M4V film.
- Original archive files were not modified.
- Video elements use `preload="metadata"`, controls and muted initial playback.

## Integration

- Updated structured project data in `app/_data/site.ts`.
- Reused `app/_components/CaseStudyPage.tsx` for film and gallery presentation.
- Reused existing Geely, Molly Tea and Stasis routes.
- Updated the homepage hero and work-index notice.
- Preserved the warm fixed palette, existing typography, static export, reduced-motion behaviour and NAS compatibility.

## Publication blockers

All reviewed client projects have `UNKNOWN` public-display permission in the existing asset register. Before publishing, confirm:

- client or agency portfolio/publicity terms;
- identifiable guest, employee and talent permissions;
- event music, screen content and third-party product rights;
- whether brand marks and unreleased products may be shown; and
- confirmed dates, locations and credits where they will appear in copy.

Stasis additionally needs careful confirmation for treatment participants, clinic/location use and third-party product references. No medical outcome claims have been added.

## Metadata limitation

Frame rate could not be reliably extracted for several earlier archive clips with the locally available tools. The three Dropbox additions were independently checked at 25 fps, 30 fps and 25 fps respectively; frame rate is not required for the current static-site integration.

## Validation

- Static build and route export: passed, with all fourteen public HTML routes generated, including `/work/bentley/`, `/work/eimele/`, `/work/chongguang-workshop/`, `/work/hatman/` and `/work/malaymalay/`.
- Automated tests: 3 passed, 0 failed.
- ESLint: passed.
- Desktop visual QA at 1280 × 720: homepage, work index, Geely, Stasis and Bentley case pages passed with no horizontal overflow.
- Mobile visual QA at 390 × 844: homepage, Geely and Bentley case pages passed; menu, hero, video and stacked gallery rendered without horizontal overflow.
- Both selected films loaded successfully in the browser with the expected 71.64-second and 102.42-second durations.
- Bentley's five selected images loaded with non-zero natural dimensions at both tested viewports.
- The Molly Tea route exports its selected poster and `.mov` source in the static client output.
- The Eimele route exports its five optimised JPEGs; the overlayed reference video is intentionally absent from the web bundle.
- Asset-level visual review covered all 21 supplied photographs and six-point video sampling.

## Aspect-ratio correction

The shared case-study gallery now carries an explicit ratio for each selected asset and renders gallery images with `object-fit: contain`. This prevents portrait assets from being forced into landscape frames and vice versa. Eimele was checked at 1280 × 720 and 390 × 844: all five images loaded at their native dimensions, the page had no horizontal overflow, and the browser console had no warnings or errors.
- Browser console: no warnings or errors during the reviewed routes.

Chongguang Workshop was additionally checked at the default desktop viewport and at 390 × 844. Its portrait cover and five gallery frames all rendered with `object-fit: contain`; after scrolling, all five gallery images loaded at their native 1650 × 2200 or 1649 × 2200 derivatives. The page stayed within the viewport width and produced no warning or error logs.

Hatman was additionally checked at the default desktop viewport and at 390 × 844. Its landscape cover and five gallery frames all rendered with `object-fit: contain`; after scrolling, all five gallery images loaded at 2200 × 1650. The page stayed within the viewport width and produced no warning or error logs.

MalayMalay was additionally checked at the default desktop viewport and at 390 × 844. Its landscape cover and four gallery frames all rendered with `object-fit: contain`; after scrolling, all four gallery images loaded at 2200 × 1650. The page stayed within the viewport width and produced no warning or error logs.

## Follow-up ingestion from SATASSD Work

On 2026-08-11, `/Volumes/SATASSD/Work/` was inventoried and copied unchanged into the workspace's pending-review asset area. The source contains 14 top-level folders, 610 JPGs and 7,240,069,567 bytes. Exact duplicate checking found zero SHA-256 duplicate groups; 112 same-name cross-directory groups indicate likely root/“美图” selection duplicates.

Bentley was the strongest visually reviewed standalone case candidate. Five web derivatives were selected from seven source images and integrated as a new `/work/bentley/` route. The case copy is deliberately neutral and labels date, credits, role and publication clearance as pending. The remaining 13 folders are staged in the pending-review asset area and are not represented as confirmed website case studies.

## Follow-up ingestion from Dropbox

Three supplied videos were copied unchanged into `10-资产管理/待审核/2026-08-11_MollyTea_Dropbox/`. Two are horizontal Molly Tea opening films; one is a separate vertical Lumière Cosmetic Clinic social film. Representative frames were reviewed across each timeline.

`Green Sq.mov` is the stronger, less redundant Molly Tea cut and is now the primary local-review film at `/work/molly-tea/`. Its poster is an extracted product frame and the source remains a `.mov` because no safe local transcode was available. `未命名项目.mov` remains staged as an alternate review source. `lumiere.mov` is not mixed into Molly Tea; the asset register already contains a different Lumière master, so this Dropbox version remains a separate pending source.

Molly Tea copy now labels the page as internal review only. Identifiable guests/staff, possible minors, street marks, client details, credits and publication permissions remain to be confirmed. Lumière requires a separate review for talent, location, treatment, device and third-party brand permissions before any public case study is created.

## Follow-up ingestion from Eimele / 亦餐

The supplied `亦餐` folder contains 21 JPEGs (595,752,414 bytes) and was copied unchanged into `10-资产管理/待审核/2026-08-11_Eimele_Yican/`. Visual review identifies a coherent Eimele coffee product/lifestyle set. Five non-redundant photographs were optimised and integrated as a new internal-review `/work/eimele/` route.

The supplied `Eimele_AD_Final_Cut_UHD_24fps_v004.mov` is an 80.208-second UHD 16:9 reference cut associated with the same campaign, but sampled frames carry review burn-in text and source/timecode overlays. It remains archived as a reference and is not embedded in the website. Project facts, model/brand/music permissions, product-claim clearance, credits and publication approval remain unresolved.

## Follow-up ingestion from Chongguang Workshop

The supplied `重光workshop` folder contains 18 JPG photographs (552,441,772 bytes, approximately 526.9 MiB). All 18 are vertical RGB/sRGB files from a FUJIFILM GFX100S, with creation dates shown in metadata from 2023-05-30 to 2023-05-31. SHA-256 checking found no exact duplicate groups. The complete source set was visually reviewed.

The images form a coherent studio beauty / fashion portrait series. A clean front-facing portrait (`_DSF1842.jpg`) is used as the cover, with five non-redundant supporting frames covering black-and-white gesture, sculptural shoulder line, profile, seated full-body shape and a foreground-hand gesture. Six JPEG derivatives were created at a maximum long edge of approximately 2200 px and integrated as `/work/chongguang-workshop/`.

The project title follows the supplied folder name only. Client relationship, date, location, credits, model release, styling/wardrobe rights and public portfolio permission are unknown. The route is labelled for internal review and uses neutral photography-only copy.

## Follow-up ingestion from Hatman

The supplied `Hatman美图` folder contains 70 JPG photographs (1,393,361,223 bytes, approximately 1.298 GiB). Sixty-nine images are landscape and one is portrait. Metadata samples show FUJIFILM GFX100S capture, sRGB colour and creation dates from 2023-06-09 to 2023-06-10. SHA-256 checking found no exact duplicate groups. The complete source set was visually reviewed.

The images form an outdoor pet-themed headwear catalog with two adult models and a Shiba Inu across waterfront, park and picnic settings. A six-image non-redundant selection was integrated as `/work/hatman/`: a two-person and dog hero plus bucket-hat, embroidered-cap, trucker-cap, knit-hat and two-person supporting frames. The project title follows the supplied folder name only; client details, date, credits, model and animal permissions, hat graphic rights and public-display clearance remain unknown.

## Follow-up ingestion from MalayMalay

The supplied `Websize-Srgb-Needs to Push Saturation` folder contains 121 JPG food photographs (approximately 309 MB). The archive includes clean web-size exports and filenames with Chinese retouch notes requesting saturation, warmth, brightness, framing and food-detail adjustments. A representative sample is 1920 × 1440 RGB/sRGB from a FUJIFILM GFX100S, created 2023-06-19. No exact SHA-256 duplicates were found in the intake check.

The images cover clean plate studies, styled tabletop food scenes, bento/service formats and a broad menu range. Five non-redundant web derivatives were integrated as `/work/malaymalay/`: one styled tabletop hero and four clean plate selections. The supplied saturation and retouch notes remain open; no unfinished adjustment was represented as completed. Client details, menu names, credits, final colour treatment and public-display permission remain unknown.

## Follow-up review from Mirror & Moon

On 2026-08-14, the `Mirror&Moon-Catalogue` folder was reviewed as the next SATASSD Work candidate. It contains 44 JPG files: 22 unique source photographs at 2:3 portrait orientation and an exact duplicate `Mirror&Moon美图` selection folder. The unique source set was visually reviewed in full; no exact duplicates were found within the 22 source files.

The photographs form a coherent editorial portrait series across coastal grassland, rock and shoreline settings, with pale and black looks, jewellery details and repeated gesture-led compositions. Six non-redundant portrait derivatives were optimised at a maximum long edge of approximately 2200 px and integrated as `/work/mirror-and-moon/`: one full-figure coastal cover, a pale close portrait, a black-on-rock frame, a striped-look full figure, a black-dress back view and a softly lit pale close portrait.

The case title follows the supplied folder name only. Client relationship, date, location, credits, model and jewellery permissions, and public-display clearance remain unknown. The route is labelled for internal review and uses neutral photography-only copy.

## Brand system handoff

On 2026-08-13, the studio identity was switched to First Rec., with Cheese identified as Founder. The supplied logo suite is archived at `10-资产管理/品牌资产/First_Rec_Logo_Suite/`; the light-background wordmark and transparent icon are served from `public/brand/first-rec/`. Header, footer, page metadata, favicon, social preview card and About copy now use First Rec. The existing contact email remains unchanged because no replacement address was supplied.
