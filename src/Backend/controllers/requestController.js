import Request from '../models/Request.js';
import Tenant from '../models/Tenant.js';
import Room from '../models/Room.js';

// @desc    Get all requests
// @route   GET /api/requests
// @access  Private/Admin
export const getRequests = async (req, res) => {
  try {
    const { status, type, priority, tenant } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (tenant) query.tenant = tenant;

    const requests = await Request.find(query)
      .populate('tenant', 'fullName phone email')
      .populate('room', 'roomNumber floor')
      .populate('resolvedBy', 'name email')
      .sort('-createdAt');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single request
// @route   GET /api/requests/:id
// @access  Private
export const getRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('tenant', 'fullName phone email')
      .populate('room', 'roomNumber floor')
      .populate('resolvedBy', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create request
// @route   POST /api/requests
// @access  Private
export const createRequest = async (req, res) => {
  try {
    const request = await Request.create(req.body);

    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update request
// @route   PUT /api/requests/:id
// @access  Private/Admin
export const updateRequest = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (['resolved', 'rejected'].includes(updateData.status)) {
      updateData.resolvedDate = updateData.resolvedDate || new Date();
      updateData.resolvedBy = updateData.resolvedBy || req.user.id;
    }

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }

    // Auto-assign room when request is resolved
    if (request.status === 'resolved' && request.room && request.tenant) {
      const tenant = await Tenant.findById(request.tenant);
      if (tenant) {
        const oldRoomId = tenant.room ? tenant.room.toString() : null;
        const newRoomId = request.room.toString();

        if (oldRoomId !== newRoomId) {
          // Remove tenant from old room
          if (oldRoomId) {
            const oldRoom = await Room.findById(oldRoomId);
            if (oldRoom) {
              oldRoom.currentTenants = oldRoom.currentTenants.filter(
                t => t.toString() !== tenant._id.toString()
              );
              if (oldRoom.currentTenants.length === 0) {
                oldRoom.status = 'available';
              }
              await oldRoom.save();
            }
          }

          // Assign new room to tenant
          tenant.room = request.room;
          await tenant.save();

          // Add tenant to new room
          const newRoom = await Room.findById(newRoomId);
          if (newRoom) {
            if (!newRoom.currentTenants.includes(tenant._id)) {
              newRoom.currentTenants.push(tenant._id);
            }
            newRoom.status = 'occupied';
            await newRoom.save();
          }
        }
      }
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete request
// @route   DELETE /api/requests/:id
// @access  Private/Admin
export const deleteRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }

    await request.deleteOne();

    res.json({
      success: true,
      message: 'Đã xóa yêu cầu thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get requests by tenant
// @route   GET /api/requests/tenant/:tenantId
// @access  Private
export const getRequestsByTenant = async (req, res) => {
  try {
    const requests = await Request.find({ tenant: req.params.tenantId })
      .populate('room', 'roomNumber floor')
      .sort('-createdAt');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Resolve request
// @route   PUT /api/requests/:id/resolve
// @access  Private/Admin
export const resolveRequest = async (req, res) => {
  try {
    const { response, status } = req.body;

    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }

    request.status = status || 'resolved';
    request.response = response;
    request.resolvedDate = new Date();
    request.resolvedBy = req.user.id;

    await request.save();

    // Auto-assign room when request is resolved
    if (request.status === 'resolved' && request.room && request.tenant) {
      const tenant = await Tenant.findById(request.tenant);
      if (tenant) {
        const oldRoomId = tenant.room ? tenant.room.toString() : null;
        const newRoomId = request.room.toString();

        if (oldRoomId !== newRoomId) {
          // Remove tenant from old room
          if (oldRoomId) {
            const oldRoom = await Room.findById(oldRoomId);
            if (oldRoom) {
              oldRoom.currentTenants = oldRoom.currentTenants.filter(
                t => t.toString() !== tenant._id.toString()
              );
              if (oldRoom.currentTenants.length === 0) {
                oldRoom.status = 'available';
              }
              await oldRoom.save();
            }
          }

          // Assign new room to tenant
          tenant.room = request.room;
          await tenant.save();

          // Add tenant to new room
          const newRoom = await Room.findById(newRoomId);
          if (newRoom) {
            if (!newRoom.currentTenants.includes(tenant._id)) {
              newRoom.currentTenants.push(tenant._id);
            }
            newRoom.status = 'occupied';
            await newRoom.save();
          }
        }
      }
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
