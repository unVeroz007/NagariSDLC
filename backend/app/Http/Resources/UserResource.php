<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'email'            => $this->email,
            'role'             => $this->role?->name,
            'role_detail'      => $this->role ? [
                'id'           => $this->role->id,
                'name'         => $this->role->name,
                'display_name' => $this->role->display_name,
            ] : null,
            'division'         => $this->division?->name,
            'division_detail'  => $this->division ? [
                'id'   => $this->division->id,
                'code' => $this->division->code,
                'name' => $this->division->name,
            ] : null,
            'phone_number'     => $this->phone_number,
            'is_active'        => $this->is_active,
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}
