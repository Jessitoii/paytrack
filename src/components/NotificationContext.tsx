import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface NotificationContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  confirm: (options: ConfirmOptions) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showToast: () => {},
  showSuccess: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
  confirm: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();

  // Toast state
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const timerRef = useRef<any>(null);

  // Modal confirm state
  const [confirmModalState, setConfirmModalState] = useState<{
    visible: boolean;
    options: ConfirmOptions | null;
    isLoading?: boolean;
  }>({
    visible: false,
    options: null,
  });

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -60, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setCurrentToast(null);
    });
  }, [fadeAnim, slideAnim]);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 3500) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setCurrentToast({
        id: `${Date.now()}_${Math.random()}`,
        type,
        title,
        message,
        duration,
      });

      fadeAnim.setValue(0);
      slideAnim.setValue(-60);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [fadeAnim, slideAnim, hideToast]
  );

  const showSuccess = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const showError = useCallback((title: string, message?: string) => showToast('error', title, message, 4500), [showToast]);
  const showWarning = useCallback((title: string, message?: string) => showToast('warning', title, message), [showToast]);
  const showInfo = useCallback((title: string, message?: string) => showToast('info', title, message), [showToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmModalState({
      visible: true,
      options,
    });
  }, []);

  const handleModalConfirm = async () => {
    if (!confirmModalState.options) return;
    try {
      setConfirmModalState((prev) => ({ ...prev, isLoading: true }));
      await confirmModalState.options.onConfirm();
    } finally {
      setConfirmModalState({ visible: false, options: null, isLoading: false });
    }
  };

  const handleModalCancel = () => {
    if (confirmModalState.options?.onCancel) {
      confirmModalState.options.onCancel();
    }
    setConfirmModalState({ visible: false, options: null, isLoading: false });
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color={colors.primary} />;
      case 'error':
        return <AlertCircle size={20} color={colors.danger} />;
      case 'warning':
        return <AlertTriangle size={20} color={colors.amber} />;
      case 'info':
      default:
        return <Info size={20} color={colors.blue} />;
    }
  };

  const getToastAccentBorder = (type: ToastType) => {
    switch (type) {
      case 'success':
        return colors.primary;
      case 'error':
        return colors.danger;
      case 'warning':
        return colors.amber;
      case 'info':
      default:
        return colors.blue;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        confirm,
      }}
    >
      {children}

      {/* Floating Animated Toast Banner */}
      {currentToast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          <SafeAreaView style={{ width: '100%', alignItems: 'center' }}>
            <View
              style={[
                styles.toastCard,
                {
                  backgroundColor: colors.cardElevated,
                  borderColor: getToastAccentBorder(currentToast.type),
                  shadowColor: isDark ? '#000000' : '#64748B',
                },
              ]}
            >
              <View style={styles.toastIconContainer}>{getToastIcon(currentToast.type)}</View>

              <View style={styles.toastTextContainer}>
                <Text style={[styles.toastTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                  {currentToast.title}
                </Text>
                {currentToast.message ? (
                  <Text style={[styles.toastMessage, { color: colors.textSecondary }]} numberOfLines={3}>
                    {currentToast.message}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity onPress={hideToast} style={styles.toastCloseButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* Modern Confirmation Modal */}
      <Modal
        visible={confirmModalState.visible}
        transparent
        animationType="fade"
        onRequestClose={handleModalCancel}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              {confirmModalState.options?.isDestructive ? (
                <View style={[styles.iconBadge, { backgroundColor: colors.dangerBg }]}>
                  <AlertCircle size={24} color={colors.danger} />
                </View>
              ) : (
                <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
                  <Info size={24} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
                {confirmModalState.options?.title}
              </Text>
            </View>

            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {confirmModalState.options?.message}
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                onPress={handleModalCancel}
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.cardBorder, backgroundColor: colors.backgroundSecondary }]}
                disabled={confirmModalState.isLoading}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textPrimary }]}>
                  {confirmModalState.options?.cancelText || 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleModalConfirm}
                style={[
                  styles.modalButton,
                  confirmModalState.options?.isDestructive
                    ? { backgroundColor: colors.danger }
                    : { backgroundColor: colors.primary },
                ]}
                disabled={confirmModalState.isLoading}
              >
                <Text style={[styles.confirmButtonText, { color: confirmModalState.options?.isDestructive ? '#FFFFFF' : colors.textInverse }]}>
                  {confirmModalState.options?.confirmText || (confirmModalState.options?.isDestructive ? 'Delete' : 'Confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  return useContext(NotificationContext);
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIconContainer: {
    marginRight: 12,
  },
  toastTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  toastMessage: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toastCloseButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
