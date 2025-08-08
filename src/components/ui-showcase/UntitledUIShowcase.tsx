import React from 'react';
import * as Icons from '@untitled-ui/icons-react';
import { HOURS_IN_DAY } from '../../utils/constants';

export const UntitledUIShowcase: React.FC = () => {
  const iconSize = HOURS_IN_DAY;
  const iconColor = '#334155';

  // Select a subset of popular icons to showcase
  const showcaseIcons = [
    { name: 'Home', Icon: Icons.Home01 },
    { name: 'User', Icon: Icons.User01 },
    { name: 'Settings', Icon: Icons.Settings01 },
    { name: 'Search', Icon: Icons.SearchMd },
    { name: 'Mail', Icon: Icons.Mail01 },
    { name: 'Calendar', Icon: Icons.Calendar },
    { name: 'Bell', Icon: Icons.Bell01 },
    { name: 'Heart', Icon: Icons.Heart },
    { name: 'Star', Icon: Icons.Star01 },
    { name: 'Download', Icon: Icons.Download01 },
    { name: 'Upload', Icon: Icons.Upload01 },
    { name: 'Trash', Icon: Icons.Trash01 },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Untitled UI Showcase</h1>
        <p className="text-gray-600 mb-8">
          A collection of beautiful, consistent icons from Untitled UI
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {showcaseIcons.map(({ name, Icon }) => (
            <div
              key={name}
              className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col items-center"
            >
              <Icon size={iconSize} color={iconColor} className="mb-3" />
              <span className="text-sm font-medium text-gray-700">{name}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Usage Example</h2>
          <div className="bg-gray-100 rounded-md p-4 font-mono text-sm">
            <div className="text-gray-600">{`import { Home01 } from '@untitled-ui/icons-react';`}</div>
            <div className="text-gray-600">{`<Home01 size={24} color="#334155" />`}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
