import {
  Controller,
  All,
  Req,
  Res,
  Headers,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { CarddavAuthGuard } from './guards/carddav-auth.guard';
import { CurrentDavSession } from './decorators/dav-session.decorator';
import { CarddavService } from './carddav.service';
import type { DavSession } from '../app-tokens/app-tokens.service';
import { XMLParser } from 'fast-xml-parser';
import { Public } from '../common/decorators/public.decorator';

// UUID v4 정규식 (하이픈 포함/미포함 모두 지원)
const UUID_REGEX = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

@Public()
@Controller()
export class CarddavController {
  private readonly xmlParser: XMLParser;

  constructor(private readonly carddavService: CarddavService) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      processEntities: false, // XXE 방지: 엔티티 처리 비활성화
      htmlEntities: false, // XXE 방지: HTML 엔티티 비활성화
    });
  }

  /**
   * .well-known/carddav - Discovery endpoint
   * Handles both GET (redirect) and PROPFIND (principal discovery)
   */
  @All('.well-known/carddav')
  @UseGuards(CarddavAuthGuard)
  async wellKnown(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @CurrentDavSession() session: DavSession,
  ) {
    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, GET, PROPFIND');
      res.header('DAV', '1, 2, 3, addressbook');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'GET') {
      return res.status(301).redirect(`/carddav/principals/${session.user.id}/`);
    }

    if (req.method === 'PROPFIND') {
      const xml = this.carddavService.buildRootPropfindResponse(session);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  /**
   * Root CardDAV endpoint - OPTIONS, PROPFIND
   */
  @All('carddav')
  @UseGuards(CarddavAuthGuard)
  async carddavRoot(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Headers('depth') _depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND');
      res.header('DAV', '1, 2, 3, addressbook');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = this.carddavService.buildRootPropfindResponse(session);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  /**
   * Principal endpoint - PROPFIND
   */
  @All('carddav/principals/:userId')
  @UseGuards(CarddavAuthGuard)
  async principal(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    // Ensure user can only access their own principal
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND');
      res.header('DAV', '1, 2, 3, addressbook');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = await this.carddavService.buildPrincipalPropfindResponse(session, depth);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  /**
   * Address book collection - PROPFIND, REPORT
   */
  @All('carddav/principals/:userId/contacts')
  @UseGuards(CarddavAuthGuard)
  async addressBook(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    // Ensure user can only access their own contacts
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND, REPORT');
      res.header('DAV', '1, 2, 3, addressbook');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = await this.carddavService.buildAddressBookPropfindResponse(session, depth);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    if (req.method === 'REPORT') {
      return this.handleReport(req, res, session);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  /**
   * Individual contact - GET, PUT (future)
   */
  @All('carddav/principals/:userId/contacts/:filename')
  @UseGuards(CarddavAuthGuard)
  async contact(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @CurrentDavSession() session: DavSession,
  ) {
    // Ensure user can only access their own contacts
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    // Extract UUID from filename (e.g., "uuid.vcf" -> "uuid")
    const uuid = filename.replace(/\.vcf$/i, '');

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, GET, HEAD, PUT, PROPFIND');
      res.header('DAV', '1, 2, 3, addressbook');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const result = await this.carddavService.getContactVcard(uuid, session);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).send();
      }

      res.header('Content-Type', 'text/vcard; charset=utf-8');
      res.header('ETag', result.etag);

      if (req.method === 'HEAD') {
        return res.status(HttpStatus.OK).send();
      }

      return res.status(HttpStatus.OK).send(result.vcard);
    }

    if (req.method === 'PROPFIND') {
      const result = await this.carddavService.getContactVcard(uuid, session);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).send();
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:response>
    <D:href>/carddav/principals/${userId}/contacts/${filename}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getetag>${result.etag}</D:getetag>
        <D:getcontenttype>text/vcard; charset=utf-8</D:getcontenttype>
        <D:current-user-privilege-set>
          <D:privilege><D:read/></D:privilege>
          <D:privilege><D:write-content/></D:privilege>
          <D:privilege><D:read-current-user-privilege-set/></D:privilege>
        </D:current-user-privilege-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    // PUT - Update contact (create not supported)
    if (req.method === 'PUT') {
      // If-None-Match: * means "create only if not exists" - we don't support contact creation
      if (ifNoneMatch === '*') {
        return res.status(HttpStatus.FORBIDDEN).send('Contact creation is not supported. Contacts are managed through the web app.');
      }

      const rawBody = req.body as Buffer | undefined;
      const vcardData = rawBody ? rawBody.toString('utf-8') : '';

      if (!vcardData) {
        return res.status(HttpStatus.BAD_REQUEST).send('Request body required');
      }

      const parsed = this.carddavService.parseVcard(vcardData);
      if (!parsed) {
        return res.status(HttpStatus.BAD_REQUEST).send('Invalid vCard data');
      }

      const result = await this.carddavService.updateStudentFromVcard(
        uuid,
        session.user.id,
        parsed,
        ifMatch,
      );

      if ('error' in result) {
        switch (result.error) {
          case 'not_found':
            return res.status(HttpStatus.NOT_FOUND).send();
          case 'forbidden':
            return res.status(HttpStatus.FORBIDDEN).send();
          case 'etag_mismatch':
            return res.status(HttpStatus.PRECONDITION_FAILED).send();
        }
      }

      res.header('ETag', result.etag);
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    // DELETE is not supported
    if (req.method === 'DELETE') {
      return res.status(HttpStatus.FORBIDDEN).send('Contact deletion is not supported');
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  /**
   * Find element in parsed XML regardless of namespace prefix
   * Handles cases like 'element', 'A:element', 'B:element', 'C:element', 'D:element'
   */
  private findElement(obj: Record<string, unknown>, localName: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;

    // Try without prefix first
    if (localName in obj) return obj[localName];

    // Try common namespace prefixes
    for (const prefix of ['A', 'B', 'C', 'D']) {
      const key = `${prefix}:${localName}`;
      if (key in obj) return obj[key];
    }

    return undefined;
  }

  /**
   * Handle REPORT requests (addressbook-multiget, sync-collection)
   */
  private async handleReport(req: FastifyRequest, res: FastifyReply, session: DavSession) {
    try {
      const rawBody = req.body as Buffer | undefined;
      const body = rawBody ? rawBody.toString('utf-8') : '';

      if (!body) {
        return res.status(HttpStatus.BAD_REQUEST).send('Request body required');
      }

      const parsed = this.xmlParser.parse(body);

      // Check if this is a sync-collection request
      const syncCollection = this.findElement(parsed, 'sync-collection');
      if (syncCollection && typeof syncCollection === 'object') {
        // Extract sync-token from request
        const syncToken = this.findElement(syncCollection as Record<string, unknown>, 'sync-token') as string | null;
        const xml = await this.carddavService.handleSyncCollection(session, syncToken);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        return res.status(HttpStatus.MULTI_STATUS).send(xml);
      }

      // Check if this is an addressbook-multiget request
      const multiget = this.findElement(parsed, 'addressbook-multiget');
      if (multiget && typeof multiget === 'object') {
        // Extract hrefs from the request
        const hrefs: string[] = [];
        const hrefNodes = this.findElement(multiget as Record<string, unknown>, 'href') || [];
        const hrefArray = Array.isArray(hrefNodes) ? hrefNodes : [hrefNodes];

        for (const href of hrefArray) {
          if (typeof href === 'string') {
            // Extract UUID from href
            const match = href.match(/\/([^/]+)\.vcf$/);
            if (match) {
              const extractedUuid = match[1];
              // UUID 형식 검증
              if (UUID_REGEX.test(extractedUuid)) {
                hrefs.push(extractedUuid);
              }
            }
          }
        }

        const xml = await this.carddavService.handleMultiget(session, hrefs);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        return res.status(HttpStatus.MULTI_STATUS).send(xml);
      }

      return res.status(HttpStatus.BAD_REQUEST).send('Unsupported REPORT type');
    }
    catch (error) {
      console.error('REPORT error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to process REPORT');
    }
  }
}
