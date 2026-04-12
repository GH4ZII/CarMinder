import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';


export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lookup"
        options={{
          title: 'Lookup',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="addCar"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="car/[id]/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="car/[id]/add-event"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="car/[id]/add-incident"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="car/[id]/obd-scan"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="car/[id]/obd-dashboard"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
