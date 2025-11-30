'use client';

import React, { useEffect, useState } from 'react';
import { InviteCodeDisplay } from '@/components/user/invite-code-display';

export default function AccountPage() {
  return (
    <div className="p-6 pt-24">
      <div className="max-w-2xl mx-auto">
        <InviteCodeDisplay />
      </div>
    </div>
  );
}
