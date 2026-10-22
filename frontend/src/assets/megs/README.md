# MEGS landing page photos

Put real MEGS photographs in this folder. The landing page picks them up by file name on the next build (`npm run dev` reloads on its own). Accepted formats: `.jpg`, `.jpeg`, `.png`, `.webp`. Keep each file under about 300 KB and at least 1200 px on the long side.

Only use photos MEGS took or owns, with consent from the people shown.

| File name | Where it shows | What to shoot |
| :--- | :--- | :--- |
| `hero` | Top of the page, above the positions list | Deployed MEGS personnel in uniform at a client site |
| `office` | About section | The Valenzuela central office, front or reception |
| `step-request` | Services, step 1 | Staff meeting a client about a manpower request |
| `step-screening` | Services, step 2 | Applicants at an interview or screening test |
| `step-contract` | Services, step 3 | New hires at contract signing |
| `step-deployment` | Services, step 4 | A service coordinator briefing workers on site |
| `industry-manufacturing` | Industries | MEGS personnel on a production line |
| `industry-logistics` | Industries | Delivery personnel, trucks, dispatch |
| `industry-warehousing` | Industries (replaces the stock photo) | Warehouse crew, forklift operators |
| `industry-retail` | Industries (replaces the stock photo) | Merchandisers, cashiers, brand ambassadors |
| `industry-hospitality` | Industries (replaces the stock photo) | Food servers, kitchen crew |
| `industry-gaming` | Industries (replaces the stock photo) | Personnel at a gaming facility |
| `activity-<caption>` | Company activities gallery | Job fairs, trainings, outreach, company events |

## Stock photos in use until MEGS photos arrive

These are not MEGS photos. Their alt text describes only what they show. Replace each by adding the matching `industry-*` file above.

| Industry | File | Source | Photographer | Licence |
| :--- | :--- | :--- | :--- | :--- |
| Manufacturing | `public/images/stock/industries/manufacturing-{480,800}.webp` | https://unsplash.com/photos/KP6XQIEjjPA | Remy Gieling | [Unsplash License](https://unsplash.com/license): free for commercial use, no attribution required |
| Logistics | `public/images/stock/industries/logistics-{480,800}.webp` | https://www.pexels.com/photo/driver-and-truck-11114134/ | Tony Mrst | [Pexels License](https://www.pexels.com/license/): free for commercial use, no attribution required |
| Warehousing, Retail, Hotel & restaurant, Gaming | `public/images/canva-ref/industries/*.webp` | MEGS Canva site, https://megsinc.my.canva.site/ | Canva stock | Canva content licence of the MEGS Canva account |

Both free photos were downloaded on 2026-10-22, cropped to 3:2 and saved as WebP.

Activity photos: the text after `activity-` becomes the caption, so `activity-2025-job-fair.jpg` shows "2025 job fair". Add as many as you like; the gallery appears once at least one exists and lists them in file-name order.
