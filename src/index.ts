import { HttpFunction } from '@google-cloud/functions-framework/build/src/functions';
import { chunkArray } from './utility/common';
import { GET_NITS_REGEX, NITS_REGEX } from './utility/const';
import { DianScrapping, ScrappingStatus } from './utility/dianScrapping';

const SCRAPPING_CRON_SECRET_KEY =
  'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a';

export const helloWorld: HttpFunction = async (req, res) => {
  const CHUNK_SEARCH_AMOUNT = 200;

  const { authorization } = req.headers;
  const input = req.query.q as string;

  if (authorization !== `Bearer ${SCRAPPING_CRON_SECRET_KEY}`) {
    return res.status(400).send('-1');
  } else if (!NITS_REGEX.test(input)) {
    return res.status(400).send('-1');
  } else if (typeof input !== 'string') {
    return res.status(400).send('-1');
  }

  const rawNitsArray = input.match(GET_NITS_REGEX)!;

  const nitsArray = Array.from(new Set(rawNitsArray)).map((nit, id) => ({
    nit,
    id,
  }));
  const totalSearch = nitsArray.length;

  const runScrapping = async () => {
    const searchArray = chunkArray(nitsArray, CHUNK_SEARCH_AMOUNT);
    const statusHandler = new ScrappingStatus({
      searchCount: nitsArray.length,
      lastId: nitsArray.at(-1)!.id,
    });
    let totalTime = 0;
    const results = [];

    for (let i = 0; i < searchArray.length; i++) {
      const ds = new DianScrapping();
      const nisToSearch = searchArray[i]!;
      const { error, nitResults, timestamp } = await ds.run(nisToSearch);

      if (nitResults && nitResults.length) {
        statusHandler.update(nitResults, nisToSearch.at(-1)!.id);

        totalTime += timestamp;
        results.push(...nitResults);
      } else if (error) {
        throw error.JSON;
      }
    }

    return { results, totalTime, totalSearch };
  };

  try {
    const response = await runScrapping();
    return res.json(response);
  } catch (error) {
    return res.status(400).json({ error });
  }
};
