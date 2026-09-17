import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { sanitizeText, isSafePublicUrl } from '@/lib/security';

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

    const { action, name, type, wishlistId, title, url, price, description, thumbnail } = body;

    // Action A: Create Manifest Item (Gift Item) inside a Wishlist Manifest
    if (action === 'add_item' || action === 'add_optool' || (wishlistId && url)) {
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

      // Create Item and link to Wishlist
      const item = await db.item.create({
        data: {
          userId: activeUserId,
          name: sanitizeText(title || 'Wished-for Item'),
          url: url.trim(),
          price: price ? Number(price) : 0,
          description: description ? sanitizeText(description) : null,
          thumbnailUrl: thumbnail ? thumbnail.trim() : null,
        },
      });

      await db.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          itemId: item.id,
        },
      });

      const formattedItem = {
        id: item.id,
        title: item.name,
        price: Number(item.price),
        url: item.url,
        thumbnail: item.thumbnailUrl || undefined,
        description: item.description || undefined,
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

    const { wishlistId, name } = body;
    if (!wishlistId || !name || !name.trim()) {
      return NextResponse.json({ error: 'wishlistId and name are required' }, { status: 400 });
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
