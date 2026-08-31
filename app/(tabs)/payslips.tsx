import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, FileText, CheckCircle, Scale, ShieldAlert, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { api } from '../../src/services/api';
import { formatEUR, formatDateShort } from '../../src/lib/formatters';

export default function PayslipsScreen() {
  const queryClient = useQueryClient();
  const [reconciliationModal, setReconciliationModal] = useState<any>(null);

  const { data: payslipsData, isLoading } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => api.listPayslips(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: DocumentPicker.DocumentPickerAsset) => {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return api.uploadPayslip({
        fileBase64: base64,
        fileName: file.name,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      Alert.alert(
        'Payslip Uploaded & Parsed',
        `Week ${data.extractedData.payrollPeriod.weekNumber} extracted successfully.\nGross: ${formatEUR(data.extractedData.totals.totalGross)}\nNet Bank Payout: ${formatEUR(data.extractedData.totals.bankPayment)}`
      );
    },
    onError: (err: any) => Alert.alert('Upload Error', err.message),
  });

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        uploadMutation.mutate(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleReconcile = async (payslipId: string) => {
    try {
      const data = await api.reconcilePayslip(payslipId);
      setReconciliationModal(data);
    } catch (err: any) {
      Alert.alert('Reconciliation Error', err.message);
    }
  };

  return (
    <View className="flex-1 bg-[#090D16]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-gray-400 text-sm font-medium">Payroll Documents</Text>
            <Text className="text-white text-3xl font-extrabold">Payslips & AI</Text>
          </View>
        </View>

        {/* Upload Card */}
        <TouchableOpacity
          onPress={handlePickDocument}
          disabled={uploadMutation.isPending}
          className="bg-card border-2 border-dashed border-emerald-500/40 rounded-3xl p-8 items-center mb-6 shadow-lg shadow-emerald-500/10"
        >
          {uploadMutation.isPending ? (
            <ActivityIndicator size="large" color="#10B981" />
          ) : (
            <>
              <View className="w-16 h-16 rounded-2xl bg-emerald-500/10 items-center justify-center mb-4">
                <FileUp size={32} color="#10B981" />
              </View>
              <Text className="text-white text-lg font-bold">Upload Dutch Payslip PDF</Text>
              <Text className="text-gray-400 text-xs text-center mt-1">
                AI extracts hours, gross, ADV, holiday allowance, StiPP, and bank payout automatically.
              </Text>
              <View className="bg-emerald-500 px-5 py-2.5 rounded-xl mt-4">
                <Text className="text-gray-950 font-bold text-xs">CHOOSE PDF FILE</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Payslips History List */}
        <View>
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Confirmed Payslips</Text>
          {payslipsData?.payslips?.length === 0 ? (
            <View className="bg-card border border-cardBorder rounded-2xl p-6 items-center">
              <Text className="text-gray-500 text-sm">No payslips uploaded yet.</Text>
            </View>
          ) : (
            payslipsData?.payslips?.map((payslip: any) => (
              <View key={payslip.id} className="bg-card border border-cardBorder rounded-2xl p-5 mb-3">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center">
                    <FileText size={20} color="#10B981" />
                    <Text className="text-white font-bold text-base ml-2">
                      Week {payslip.payrollWeek?.weekNumber ?? '–'}
                    </Text>
                  </View>
                  <View className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex-row items-center">
                    <CheckCircle size={12} color="#10B981" />
                    <Text className="text-emerald-400 font-bold text-xs ml-1">{payslip.parsingStatus}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-baseline mb-4">
                  <View>
                    <Text className="text-gray-500 text-xs">Gross Pay</Text>
                    <Text className="text-gray-300 text-sm font-semibold mt-0.5">{formatEUR(payslip.totalGross)}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs">Bank Payout</Text>
                    <Text className="text-emerald-400 text-xl font-extrabold mt-0.5">{formatEUR(payslip.bankPayment)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleReconcile(payslip.id)}
                  className="bg-[#0B0F19] border border-gray-800 py-2.5 rounded-xl flex-row items-center justify-center"
                >
                  <Scale size={16} color="#9CA3AF" />
                  <Text className="text-gray-300 font-bold text-xs ml-1.5">Compare vs Calculated Estimate</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reconciliation Modal */}
      <Modal visible={!!reconciliationModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-card border-t border-cardBorder rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Week {reconciliationModal?.weekNumber} Reconciliation</Text>
              <TouchableOpacity onPress={() => setReconciliationModal(null)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {reconciliationModal?.variance ? (
              <View className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-4 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-400 text-xs">Actual Bank Payout</Text>
                  <Text className="text-emerald-400 font-extrabold text-base">{formatEUR(reconciliationModal.actual.bankPayment)}</Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-400 text-xs">Calculated Estimate</Text>
                  <Text className="text-gray-300 font-bold text-base">{formatEUR(reconciliationModal.estimate?.bankPayment)}</Text>
                </View>
                <View className="h-px bg-gray-800 my-2" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-400 text-xs font-semibold">Variance</Text>
                  <Text className={`font-extrabold text-sm ${reconciliationModal.variance.isMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatEUR(reconciliationModal.variance.bankPaymentDifference)} ({reconciliationModal.variance.isMatch ? 'Match' : 'Difference'})
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-gray-400 text-sm mb-4">No estimate found for this week to compare.</Text>
            )}

            <TouchableOpacity
              onPress={() => setReconciliationModal(null)}
              className="bg-emerald-500 py-3.5 rounded-xl items-center"
            >
              <Text className="text-gray-950 font-bold text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
