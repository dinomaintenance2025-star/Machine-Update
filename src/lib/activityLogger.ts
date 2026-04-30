import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, PortalActivity } from '../types';

export const logActivity = async (
  user: AppUser | undefined | null,
  action: string,
  details: string,
  entityType?: PortalActivity['entityType'],
  entityId?: string
) => {
  if (!user) return;

  try {
    const activity: Omit<PortalActivity, 'id'> = {
      userId: user.uid,
      userEmail: user.email || 'unknown',
      userName: user.displayName || user.email || 'Anonymous',
      action,
      details,
      entityType,
      entityId,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'activities'), activity);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};
