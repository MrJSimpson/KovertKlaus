import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { sanitizeText, isSafePublicUrl, normalizeProductUrl } from '@/lib/security';
import { sanitizeItemDetails, updateCatalogIntelligence } from '@/lib/product-intelligence';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const activeUserId = await getSessionUserId();

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const wishlists = await db.wishlist.findMany({
      where: { userId: activeUserId },
      include: {
        wishlistItems: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = wishlists.map((w, idx) => {
      const items = w.wishlistItems.map((wi) => ({
        id: wi.item.id,
        title: wi.item.name,
        price: wi.item.price ? Number(wi.item.price) : undefined,
        url: wi.item.url,
        thumbnail: wi.item.thumbnailUrl || undefined,
        description: wi.item.description || undefined,
        properties: wi.item.properties || undefined,
      }));

      return {
        id: w.id,
        name: w.name,
        isMaster: idx === 0,
        type: w.type,
        createdAt: w.createdAt,
        manifestItems: items,
        opTools: items,
      };
    });

    return NextResponse.json({ success: true, manifests: formatted, opKits: formatted });
  } catch (error) {
    console.error('Wishlist Manifests GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch Wishlist Manifests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { action, name, type, wishlistId, title, url, price, description, thumbnail, properties } = body;

    // Action A: Create Manifest Item (Gift Item) inside a Wishlist Manifest
    if (action === 'add_item' || action === 'add_optool' || action === 'add_manifest_item' || (wishlistId && url)) {
      if (!wishlistId || !url) {
        return NextResponse.json({ error: 'wishlistId and url are required to add a Manifest Item' }, { status: 400 });
      }

      const urlCheck = isSafePublicUrl(url);
      if (!urlCheck.safe) {
        return NextResponse.json({ error: urlCheck.error || 'Invalid or forbidden URL' }, { status: 400 });
      }

      const wishlist = await db.wishlist.findUnique({
        where: { id: wishlistId },
        include: { wishlistItems: true },
      });

      if (!wishlist || wishlist.userId !== activeUserId) {
        return NextResponse.json({ error: 'Wishlist Manifest not found or unauthorized' }, { status: 404 });
      }

      // Enforce 1-item limit for White Elephant
      if (wishlist.type === 'WHITE_ELEPHANT' && wishlist.wishlistItems.length >= 1) {
        return NextResponse.json({
          error: '🐘 White Elephant Wishlist Manifests are strictly limited to 1 brought gift item per operative!',
        }, { status: 400 });
      }

      const details = Array.isArray(properties?.details)
        ? sanitizeItemDetails(properties.details)
        : [];
      const itemProperties = details.length > 0 ? { details } : undefined;

      // Create Item and link to Wishlist
      const item = await db.item.create({
        data: {
          userId: activeUserId,
          name: sanitizeText(title || 'Wished-for Item'),
          url: url.trim(),
          price: price ? Number(price) : 0,
          description: description ? sanitizeText(description) : null,
          thumbnailUrl: thumbnail ? thumbnail.trim() : null,
          properties: itemProperties ? (itemProperties as unknown as Prisma.InputJsonValue) : undefined,
        },
      });

      await db.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          itemId: item.id,
        },
      });

      if (details.length > 0) {
        (async () => {
          try {
            const normalizedUrl = normalizeProductUrl(url.trim());
            const cat = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
            if (cat) {
              const updatedCatalogProps = updateCatalogIntelligence(cat.properties, details);
              await db.productCatalog.update({
                where: { url: normalizedUrl },
                data: { properties: updatedCatalogProps as unknown as Prisma.InputJsonValue },
              });
            }
          } catch (e) {
            console.warn('[ProductCatalog Intelligence Update Error]', e);
          }
        })();
      }

      const formattedItem = {
        id: item.id,
        title: item.name,
        price: Number(item.price),
        url: item.url,
        thumbnail: item.thumbnailUrl || undefined,
        description: item.description || undefined,
        properties: item.properties || undefined,
      };

      return NextResponse.json({
        success: true,
        message: 'Manifest Item added to Wishlist Manifest',
        manifestItem: formattedItem,
        opTool: formattedItem,
      });
    }

    // Action B: Create New Wishlist Manifest
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Wishlist Manifest name is required' }, { status: 400 });
    }

    const newWishlist = await db.wishlist.create({
      data: {
        userId: activeUserId,
        name: sanitizeText(name),
        type: type === 'WHITE_ELEPHANT' ? 'WHITE_ELEPHANT' : 'STANDARD',
      },
    });

    const formattedManifest = {
      id: newWishlist.id,
      name: newWishlist.name,
      isMaster: false,
      type: newWishlist.type,
      createdAt: newWishlist.createdAt,
      manifestItems: [],
      opTools: [],
    };

    return NextResponse.json({
      success: true,
      manifest: formattedManifest,
      opKit: formattedManifest,
    });
  } catch (error) {
    console.error('Wishlist Manifests POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const activeUserId = await getSessionUserId();

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { wishlistId, itemId, name, title, price, description, thumbnail, properties } = body;

    // Item update
    if (itemId) {
      const details = Array.isArray(properties?.details)
        ? sanitizeItemDetails(properties.details)
        : undefined;

      const updateData: any = {};
      if (title !== undefined) updateData.name = sanitizeText(title);
      if (price !== undefined) updateData.price = Number(price);
      if (description !== undefined) updateData.description = description ? sanitizeText(description) : null;
      if (thumbnail !== undefined) updateData.thumbnailUrl = thumbnail ? thumbnail.trim() : null;
      if (details !== undefined) {
        updateData.properties = details.length > 0 ? { details } : Prisma.JsonNull;
      }

      const existingItem = await db.item.findFirst({
        where: { id: itemId, userId: activeUserId },
      });

      if (!existingItem) {
        return NextResponse.json({ error: 'Manifest Item not found or unauthorized' }, { status: 404 });
      }

      const updated = await db.item.update({
        where: { id: itemId },
        data: updateData,
      });

      if (details && details.length > 0 && existingItem.url) {
        (async () => {
          try {
            const normalizedUrl = normalizeProductUrl(existingItem.url);
            const cat = await db.productCatalog.findUnique({ where: { url: normalizedUrl } });
            if (cat) {
              const updatedCatalogProps = updateCatalogIntelligence(cat.properties, details);
              await db.productCatalog.update({
                where: { url: normalizedUrl },
                data: { properties: updatedCatalogProps as unknown as Prisma.InputJsonValue },
              });
            }
          } catch (e) {
            console.warn('[ProductCatalog Intelligence Update Error]', e);
          }
        })();
      }

      return NextResponse.json({
        success: true,
        message: 'Manifest Item updated successfully',
        manifestItem: {
          id: updated.id,
          title: updated.name,
          price: Number(updated.price),
          url: updated.url,
          thumbnail: updated.thumbnailUrl || undefined,
          description: updated.description || undefined,
          properties: updated.properties || undefined,
        },
      });
    }

    // Wishlist rename
    if (!wishlistId || !name || !name.trim()) {
      return NextResponse.json({ error: 'wishlistId and name (or itemId) are required' }, { status: 400 });
    }

    const updated = await db.wishlist.updateMany({
      where: { id: wishlistId, userId: activeUserId },
      data: { name: sanitizeText(name) },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Wishlist Manifest not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Wishlist Manifest renamed successfully' });
  } catch (error) {
    console.error('Wishlist Manifests PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update Wishlist Manifest' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wishlistId = searchParams.get('wishlistId');
    const itemId = searchParams.get('itemId');
    const activeUserId = await getSessionUserId();

    if (!activeUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (itemId) {
      await db.item.deleteMany({
        where: { id: itemId, userId: activeUserId },
      });
      return NextResponse.json({ success: true, message: 'Manifest Item removed successfully' });
    }

    if (wishlistId) {
      await db.wishlist.deleteMany({
        where: { id: wishlistId, userId: activeUserId },
      });
      return NextResponse.json({ success: true, message: 'Wishlist Manifest deleted successfully' });
    }

    return NextResponse.json({ error: 'wishlistId or itemId is required' }, { status: 400 });
  } catch (error) {
    console.error('Wishlist Manifests DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete Wishlist Manifest resource' }, { status: 500 });
  }
}
