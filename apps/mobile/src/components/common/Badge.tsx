import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { container: object; text: object }> = {
  default: { container: { backgroundColor: '#e5e7eb' }, text: { color: '#374151' } },
  success: { container: { backgroundColor: '#dcfce7' }, text: { color: '#166534' } },
  warning: { container: { backgroundColor: '#fef9c3' }, text: { color: '#854d0e' } },
  danger: { container: { backgroundColor: '#fee2e2' }, text: { color: '#991b1b' } },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const vs = variantStyles[variant];
  return (
    <View style={[styles.container, vs.container]}>
      <Text style={[styles.text, vs.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
