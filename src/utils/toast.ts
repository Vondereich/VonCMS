import toast from 'react-hot-toast';

/**
 * Toast notification helper
 * Centralized toast notifications for VonCMS
 */

export const notify = {
  success: (message: string, duration = 3000) => {
    toast.success(message, { duration });
  },

  error: (message: string, duration = 4000) => {
    toast.error(message, { duration });
  },

  info: (message: string, duration = 3000) => {
    toast(message, { duration });
  },

  loading: (message: string) => {
    return toast.loading(message);
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

export default notify;
