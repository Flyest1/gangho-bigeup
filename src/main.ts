import './styles/base.css';
import './styles/layout.css';
import './styles/combat.css';
import './styles/screens.css';
import { mountApp } from './ui/app';

const root = document.getElementById('app');
if (root) mountApp(root);
