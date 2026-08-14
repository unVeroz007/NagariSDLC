<?php

namespace App\Enums;

enum TaskStatus: string
{
    case TODO = 'todo';
    case IN_PROGRESS = 'in_progress';
    case HOLD = 'hold';
    case DONE = 'done';
    case TAKE_DOWN = 'take_down';
}
