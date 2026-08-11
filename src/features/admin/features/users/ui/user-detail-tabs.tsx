"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/features/admin/components/ui/tabs";
import { Card } from "@/features/admin/components/ui/card";
import { UserProfileCard } from "./user-profile-card";
import { UserPremiumCard } from "./user-premium-card";
import { UserRoleCard } from "./user-role-card";
import { UserAccountCard } from "./user-account-card";
import { UserActivity } from "./user-activity";
import { UserNotesCard } from "./user-notes-card";
import type {
  AdminUserRow,
  AdminUserNote,
  AdminUserActivityItem,
} from "@/lib/database.types";

export interface DetailPermissions {
  canPremium: boolean;
  canRole: boolean;
  canBan: boolean;
  canDelete: boolean;
}

export function UserDetailTabs({
  user,
  notes,
  activity,
  perms,
}: {
  user: AdminUserRow;
  notes: AdminUserNote[];
  activity: AdminUserActivityItem[];
  perms: DetailPermissions;
}) {
  return (
    <Tabs defaultValue="manage">
      <TabsList>
        <TabsTrigger value="manage">Yönetim</TabsTrigger>
        <TabsTrigger value="activity">Aktivite Geçmişi</TabsTrigger>
        <TabsTrigger value="notes">Notlar</TabsTrigger>
      </TabsList>

      <TabsContent value="manage">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <UserProfileCard user={user} />
          </div>
          <UserPremiumCard user={user} canManage={perms.canPremium} />
          <UserRoleCard user={user} canManage={perms.canRole} />
          <div className="lg:col-span-2">
            <UserAccountCard user={user} canBan={perms.canBan} canDelete={perms.canDelete} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="activity">
        <Card className="p-5">
          <UserActivity items={activity} />
        </Card>
      </TabsContent>

      <TabsContent value="notes">
        <UserNotesCard userId={user.id} notes={notes} />
      </TabsContent>
    </Tabs>
  );
}
