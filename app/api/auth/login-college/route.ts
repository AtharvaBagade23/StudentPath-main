import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { CollegeRow } from '@/lib/db-types';

interface LoginCollegeRow extends CollegeRow {
  password_hash: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    
    // Find college by email
    const [collegeResult] = await connection.execute<LoginCollegeRow[]>(
      'SELECT id, college_name, email, password_hash, college_token, is_active FROM colleges WHERE email = ?',
      [email]
    );

    if (!collegeResult || collegeResult.length === 0) {
      connection.release();
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const college = collegeResult[0];

    // Check if college is active
    if (!college.is_active) {
      connection.release();
      return NextResponse.json(
        { error: 'College account is inactive' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, college.password_hash);
    
    if (!isValidPassword) {
      connection.release();
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    connection.release();

    // Create the response
    const response = NextResponse.json({
      success: true,
      college: {
        id: college.id,
        name: college.college_name,
        email: college.email,
        token: college.college_token
      }
    });

    // Set secure cookies
    response.cookies.set('collegeData', JSON.stringify({
      id: college.id,
      name: college.college_name,
      email: college.email,
      token: college.college_token,
      type: 'college'
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    response.cookies.set('authToken', college.college_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('College login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
