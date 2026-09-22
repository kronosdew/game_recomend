import { openDb } from '@/lib/catalog/db';
import { refreshCatalog } from '@/lib/catalog/refresh';

const db = openDb();
refreshCatalog(db)
  .then((r) => {
    console.log(
      `Katalog tazelendi: +${r.added}, atlanan ${r.skipped}, taranan ${r.totalFound}`,
    );
  })
  .catch((e) => { console.error(e); process.exit(1); });
