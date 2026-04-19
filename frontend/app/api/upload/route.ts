import { NextRequest, NextResponse } from 'next/server';

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const recordType = formData.get('recordType') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json(
        { error: 'Pinata JWT not configured' },
        { status: 500 }
      );
    }

    const data = new FormData();
    data.append('file', file);

    // Optional: Add metadata
    const metadata = {
      name: file.name,
      keyvalues: {
        recordType: recordType || 'unknown',
        uploadedAt: new Date().toISOString(),
      },
    };
    data.append('pinataMetadata', JSON.stringify(metadata));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: data,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Pinata upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload to IPFS', details: error },
        { status: response.status }
      );
    }

    const result: PinataUploadResponse = await response.json();

    return NextResponse.json({
      success: true,
      cid: result.IpfsHash,
      ipfsHash: result.IpfsHash,
      size: result.PinSize,
      timestamp: result.Timestamp,
      gateway: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
