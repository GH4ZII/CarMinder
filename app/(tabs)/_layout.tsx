import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2DD4BF',
        tabBarInactiveTintColor: '#7F90A7',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A1A37',
          borderTopColor: '#294263',
          borderTopWidth: 1,
          height: 76,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
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
