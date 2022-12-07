import puppeteer, { Browser, Page } from 'puppeteer';
import { delayRace } from './common';

type NitStatus = {
  id: number;
  _nit: string;
  status: string;
};

type NitResult =
  | NitStatus
  | (NitStatus & {
      dv: string;
      companyName: string;
    })
  | (NitStatus & {
      dv: string;
      firstName: string;
      otherNames: string;
      lastName: string;
      secondLastName: string;
    });

export class ErrorScrapping<T = undefined> extends Error {
  payload?: T;
  code: string;
  constructor({
    error,
    code,
    payload,
  }: {
    error: unknown;
    code: string;
    payload?: T;
  }) {
    super((<Error>error).message);
    this.payload = payload;
    this.code = code;
  }

  get JSON() {
    const { message, code, payload } = this;

    return {
      message,
      code,
      payload,
    };
  }
}

export class DianScrapping {
  browser!: Browser;
  page!: Page;

  _LABEL_DISPLAY_NIT = '[labeldisplay=Nit]';

  init = async () => {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        ' Mozilla/5.0 (Linux; Android 9; Redmi Note 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36'
      );
    } catch (error) {
      throw new ErrorScrapping({
        code: 'OPEN_BROWSER',
        error,
      });
    }
  };

  openDian = async () => {
    try {
      await this.page.goto(
        'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces'
      );

      await this.page.waitForSelector(this._LABEL_DISPLAY_NIT);
    } catch (error) {
      throw new ErrorScrapping({
        code: 'DIAN_PAGE',
        error,
      });
    }
  };

  typeAndSubmit = async (nit: string) => {
    try {
      await this.page.type(this._LABEL_DISPLAY_NIT, nit);
      await Promise.all([
        this.page.click(this.getSelectorField('btnBuscar')),
        this.page.waitForNavigation(),
      ]);
    } catch (error) {
      throw new ErrorScrapping({
        code: 'SUBMITTING_NIT',
        error,
        payload: { nit },
      });
    }
  };

  private getSelectorField = (field: string) => {
    const VISTA_CONSULTA_ESTADO_RUT_FORM_CONSULTA_ESTADO_RUT =
      '#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:';

    return `${VISTA_CONSULTA_ESTADO_RUT_FORM_CONSULTA_ESTADO_RUT}${field}`;
  };

  readPage = async (nit: string) => {
    try {
      const data = await this.page.evaluate(() => {
        const getSelectorField = (field: string) => {
          const VISTA_CONSULTA_ESTADO_RUT_FORM_CONSULTA_ESTADO_RUT =
            '#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:';

          return `${VISTA_CONSULTA_ESTADO_RUT_FORM_CONSULTA_ESTADO_RUT}${field}`;
        };

        const nitInput = document.querySelector<HTMLInputElement>(
          getSelectorField('numNit')
        )!;
        const _nit = nitInput.value;
        nitInput.value = '';

        const dv = document.querySelector(getSelectorField('dv'))
          ?.innerHTML as string;

        if (!dv) {
          document
            .querySelector<HTMLImageElement>('[onclick="cerrarLayer();"]')!
            .click();

          return {
            _nit: _nit,
            status: 'INVALID',
          };
        } else {
        }

        const status = document.querySelector(
          getSelectorField('estado')
        )!.innerHTML;
        const razonSocial = document.querySelector(
          getSelectorField('razonSocial')
        )?.innerHTML;

        if (razonSocial) {
          return {
            _nit: _nit,
            dv,
            status,
            companyName: razonSocial,
          };
        }

        const firstName = document.querySelector(
          getSelectorField('primerNombre')
        )?.innerHTML;
        const otherNames = document.querySelector(
          getSelectorField('otrosNombres')
        )!.innerHTML;
        const lastName = document.querySelector(
          getSelectorField('primerApellido')
        )!.innerHTML;
        const secondLastName = document.querySelector(
          getSelectorField('segundoApellido')
        )!.innerHTML;

        return {
          _nit: _nit,
          dv,
          lastName,
          secondLastName,
          firstName,
          otherNames,
          status,
        };
      });

      return data;
    } catch (error) {
      throw new ErrorScrapping({
        code: 'READING_PAGE',
        error,
        payload: { nit },
      });
    }
  };

  typeSubmitAndRead = async (nit: string) => {
    await this.typeAndSubmit(nit);
    return await this.readPage(nit);
  };

  close = async () => {
    try {
      await this.browser.close();
    } catch (error) {
      throw new ErrorScrapping({
        code: 'CLOSING_BROSER',
        error,
      });
    }
  };

  private runTimestamp = () => {
    const startTime = Date.now();
    return () => startTime - Date.now();
  };

  run = async (
    nits: { id: number; nit: string }[],
    { interruptAt = 5, timeout = 1000 } = {
      interruptAt: 5,
      timeout: 1000,
    }
  ) => {
    const nitResults: Array<NitResult> = [];

    let interruptCount = 0;
    const timestamp = this.runTimestamp();

    try {
      await this.init();
      await this.openDian();
      for (let i = 0; i < nits.length; i++) {
        const { nit, id } = nits[i]!;

        const nitInfo = await delayRace(this.typeSubmitAndRead(nit), timeout);

        if (nitInfo) {
          nitResults.push({ ...nitInfo, id });
        } else {
          interruptCount++;
        }

        if (interruptCount === interruptAt) {
          throw new ErrorScrapping({
            code: 'INTERRUPTION_FORCED',
            error: Error(`interruptAt:${interruptAt},timeout:${timeout}`),
          });
        }
      }
    } catch (error) {
      return { error: error as ErrorScrapping, timestamp: timestamp() };
    } finally {
      await this.close().catch(() => null);
    }

    return { nitResults, timestamp: timestamp() };
  };
}

export class ScrappingStatus {
  searchCount: number;
  lastId: number;
  ends = false;

  constructor({
    searchCount,
    lastId,
  }: {
    searchCount: number;
    lastId: number;
  }) {
    this.searchCount = searchCount;
    this.lastId = lastId;
  }

  update(nitResults: { id: number }[], lastId: number) {
    this.searchCount -= nitResults.length;
    this.ends = lastId === this.lastId;
    return this;
  }

  get status() {
    if (this.searchCount === 0) {
      return 'COMPLETED';
    } else if (this.ends) {
      return 'PENDING';
    } else {
      return 'CONSULTING';
    }
  }
}
