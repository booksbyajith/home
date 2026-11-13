import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * Fractional CPU (the "gen1" sizes: 256 MiB -> 1/6 vCPU, 512 MiB -> 1/3 vCPU) for every function.
 * Plenty for this traffic, and it keeps deploys inside a new project's regional CPU quota: with a
 * full vCPU each, updating all functions at once failed with "Quota exceeded for total allowable
 * CPU per project per region". Imported first in index.ts so it applies before any function is
 * defined.
 */
setGlobalOptions({ cpu: 'gcf_gen1' });
